import { v4 as uuidv4 } from 'uuid';

console.log("Testing uuid...");
try {
    const id = uuidv4();
    console.log("Generated UUID:", id);
} catch (e) {
    console.error("UUID generation failed:", e);
}

// Simulate the parsing logic
const textResponse = `
\`\`\`json
[
  {
    "title": "Test Task",
    "category": "Test",
    "date": "2023-01-01",
    "time": "10:00"
  }
]
\`\`\`
`;

console.log("Testing parsing...");
try {
    let cleaned = textResponse.replace(/```json/g, '').replace(/```/g, '').trim();
    console.log("Cleaned text:", cleaned);
    const tasks = JSON.parse(cleaned);
    console.log("Parsed tasks:", tasks);

    const todos = tasks.map(task => ({
        id: uuidv4(),
        title: task.title,
        category: task.category || 'その他',
        date: task.date,
        time: task.time,
        completed: false,
        createdAt: new Date().toISOString()
    }));
    console.log("Mapped todos:", todos);
} catch (e) {
    console.error("Parsing failed:", e);
}
