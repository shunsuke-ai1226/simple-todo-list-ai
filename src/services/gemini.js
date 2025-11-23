import { GoogleGenerativeAI } from "@google/generative-ai";
import { v4 as uuidv4 } from 'uuid';

export const generateTodosFromText = async (text, apiKey) => {
  if (!apiKey) {
    throw new Error("API Keyが設定されていません。設定画面から入力してください。");
  }

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash-exp" });

  const prompt = `
    あなたは優秀なタスク管理アシスタントです。
    以下のユーザーの入力文を解析し、具体的なタスク（ToDo）のリストに変換してください。
    
    出力は以下のJSON形式の配列のみを返してください。余計な説明やマークダウン記法（\`\`\`jsonなど）は不要です。
    
    [
      {
        "title": "タスクの内容（具体的かつ簡潔に）",
        "category": "タスクのカテゴリ（例: 仕事, 個人, 買い物, 健康, その他）",
        "date": "YYYY-MM-DD形式の日付（明記されていない場合はnull）",
        "time": "HH:mm形式の時間（明記されていない場合はnull）"
      }
    ]

    今日の日付は ${new Date().toISOString().split('T')[0]} です。「明日」「来週」などの相対的な表現はこの日付を基準に計算してください。

    ユーザー入力:
    "${text}"
  `;

  try {
    const result = await model.generateContent(prompt);
    const response = await result.response;
    let textResponse = response.text();

    // Clean up markdown code blocks if present
    textResponse = textResponse.replace(/```json/g, '').replace(/```/g, '').trim();

    const tasks = JSON.parse(textResponse);

    if (!Array.isArray(tasks)) {
      throw new Error("AIからの応答が配列形式ではありませんでした。");
    }

    return tasks.map(task => ({
      id: uuidv4(),
      title: String(task.title || '無題のタスク'),
      category: String(task.category || 'その他'),
      date: task.date ? String(task.date) : '',
      time: task.time ? String(task.time) : '',
      completed: false,
      createdAt: new Date().toISOString()
    }));
  } catch (error) {
    console.error("Gemini API Error Details:", error);
    throw new Error(`タスクの生成に失敗しました。(${error.message}) APIキーが正しいか確認してください。`);
  }
};
