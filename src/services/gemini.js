import { GoogleGenerativeAI } from "@google/generative-ai";
import { v4 as uuidv4 } from 'uuid';

export const generateTodosFromText = async (text, apiKey) => {
  if (!apiKey) {
    throw new Error("API Keyが設定されていません。設定画面から入力してください。");
  }

  const genAI = new GoogleGenerativeAI(apiKey);
  
  // Gemini 2.0 Flashモデルのリスト（優先順位順）
  // 無料枠が大きく、高速で動作するGemini 2.0 Flashを使用
  const modelNames = [
    "gemini-2.0-flash-exp",     // Gemini 2.0 Flash（実験的、無料枠が大きい）
    "gemini-2.0-flash",         // Gemini 2.0 Flash（安定版）
    "gemini-2.0-flash-thinking-exp", // Gemini 2.0 Flash Thinking（実験的）
    "gemini-1.5-flash-latest",  // フォールバック: 1.5 Flash最新版
    "gemini-1.5-pro-latest"     // フォールバック: 1.5 Pro最新版
  ];
  
  let lastError = null;
  
  // 各モデルを順に試す
  for (const modelName of modelNames) {
    try {
      const model = genAI.getGenerativeModel({ model: modelName });

      const prompt = `
    あなたは優秀なタスク管理アシスタントです。
    以下のユーザーの入力文を解析し、具体的なタスク（ToDo）のリストに変換してください。
    複合的な指示（例: 「AをしてからBをする」）は、必ず複数のタスクに分割してください。
    
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

      const result = await model.generateContent(prompt);
      const response = await result.response;
      let textResponse = response.text();

      // Clean up markdown code blocks if present
      textResponse = textResponse.replace(/```json/g, '').replace(/```/g, '').trim();

      const tasks = JSON.parse(textResponse);

      if (!Array.isArray(tasks)) {
        throw new Error("AIからの応答が配列形式ではありませんでした。");
      }

      // 成功した場合は結果を返す
      console.log(`成功: モデル ${modelName} を使用しました`);
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
      console.error(`モデル ${modelName} でのエラー:`, error.message);
      lastError = error;
      // 次のモデルを試す
      continue;
    }
  }
  
  // すべてのモデルで失敗した場合
  console.error("すべてのモデルでエラーが発生しました。最後のエラー:", lastError);
  throw new Error(`タスクの生成に失敗しました。(${lastError?.message || '不明なエラー'}) 利用可能なモデルが見つかりませんでした。APIキーが正しいか確認してください。`);
};
