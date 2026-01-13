import express from "express";
import multer from "multer";
import OpenAI from "openai";
import fs from "fs";
import cors from "cors";

const app = express();
app.use(cors());
const upload = multer({ dest: "uploads/" });

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

app.post("/ask", upload.single("audio"), async (req, res) => {
  try {
    const audioPath = req.file.path;

    // 1. Speech to text
    const transcript = await openai.audio.transcriptions.create({
      file: fs.createReadStream(audioPath),
      model: "whisper-1",
    });

    const userText = transcript.text;

    // 2. Mesero NPC
    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "system", content: "Eres un amable mesero de una cafetería. Respondes de forma breve y amigable." },
        { role: "user", content: userText }
      ]
    });

    const reply = completion.choices[0].message.content;

    // 3. Text to speech
    const tts = await openai.audio.speech.create({
      model: "gpt-4o-mini-tts",
      voice: "alloy",
      input: reply,
    });

    const buffer = Buffer.from(await tts.arrayBuffer());

    res.set("Content-Type", "audio/wav");
    res.send(buffer);

    fs.unlinkSync(audioPath);
  }
  catch (err) {
    console.error(err);
    res.status(500).send("AI error");
  }
});

app.listen(3000, () => {
  console.log("AI Server running");
});
