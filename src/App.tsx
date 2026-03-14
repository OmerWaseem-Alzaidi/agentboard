import { useEffect, useState } from 'react';
import { db, initPowerSync } from './lib/powersync';

function App() {
  const [syncing, setSyncing] = useState(false);
  const [taskCount, setTaskCount] = useState(0);
  const [tasks, setTasks] = useState<any[]>([]);

  useEffect(() => {
    initPowerSync().then(() => {
      console.log('PowerSync initialized');
      setSyncing(true);

      // Watch for task count
      (async () => {
        for await (const result of db.watch('SELECT COUNT(*) as count FROM tasks', [])) {
          const firstRow = result.rows?.item(0);
          setTaskCount((firstRow as any)?.count ?? 0);
        }
      })();

      // Watch for all tasks
      (async () => {
        for await (const result of db.watch('SELECT * FROM tasks ORDER BY created_at DESC', [])) {
          const taskArray: any[] = [];
          if (result.rows) {
            for (let i = 0; i < result.rows.length; i++) {
              taskArray.push(result.rows.item(i));
            }
          }
          setTasks(taskArray);
        }
      })();
    });
  }, []);

  const createTestTask = async () => {
    await db.execute(
      `INSERT INTO tasks (id, title, description, status, label, created_by, created_at, updated_at) 
       VALUES (?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))`,
      [
        crypto.randomUUID(),
        'Test Task ' + Math.floor(Math.random() * 1000),
        'This is a test task created from the UI',
        'todo',
        'research',
        'test-user'
      ]
    );
  };

  return (
    <div className="min-h-screen bg-gray-100 p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-4xl font-bold text-blue-600">
          AgentBoard
        </h1>
        <p className="mt-4 text-gray-700">
          Tailwind CSS: ✅
        </p>
        <p className="mt-2 text-gray-700">
          PowerSync: {syncing ? '✅ Syncing!' : '⏳ Connecting...'}
        </p>
        <p className="mt-2 text-gray-700">
          Tasks in database: {taskCount}
        </p>

        <button
          onClick={createTestTask}
          className="mt-4 bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700"
        >
          Create Test Task
        </button>

        <div className="mt-8">
          <h2 className="text-2xl font-bold mb-4">Tasks:</h2>
          {tasks.map((task) => (
            <div key={task.id} className="bg-white p-4 rounded-lg shadow mb-2">
              <h3 className="font-bold">{task.title}</h3>
              <p className="text-sm text-gray-600">{task.description}</p>
              <p className="text-xs text-gray-400 mt-2">
                Status: {task.status} | Label: {task.label}
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default App;