import express from "express";
import multer from "multer";
import OpenAI from "openai";
import fs from "fs";
import cors from "cors";

const app = express();
app.use(cors());

// Railway sólo permite escritura en /tmp
const upload = multer({ dest: "/tmp" });

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

app.post("/ask", upload.single("audio"), async (req, res) => {
  try {
    if (!req.file) {
      console.error("No audio file received");
      return res.status(400).json({ error: "No audio uploaded" });
    }

    console.log("Audio received:", req.file.originalname, req.file.mimetype);

    // 1️⃣ Speech → Text
    const transcript = await openai.audio.transcriptions.create({
      file: fs.createReadStream(req.file.path),
      model: "gpt-4o-transcribe"
    });

    const userText = transcript.text;
    console.log("User said:", userText);

    // 2️⃣ NPC Mesero
    const chat = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: "Eres un amable mesero de una cafetería. Respondes de forma breve, natural y amigable."
        },
        {
          role: "user",
          content: userText
        }
      ]
    });

    const reply = chat.choices[0].message.content;
    console.log("NPC:", reply);

    // 3️⃣ Text → Speech
    const tts = await openai.audio.speech.create({
      model: "gpt-4o-mini-tts",
      voice: "alloy",
      input: reply
    });

    const buffer = Buffer.from(await tts.arrayBuffer());

    // Enviar audio al Quest
    res.setHeader("Content-Type", "audio/wav");
    res.send(buffer);

    fs.unlinkSync(req.file.path);

  } catch (err) {
    console.error("AI ERROR:", err);
    res.status(500).json({ error: err.message });
  }
});

app.listen(3000, () => {
  console.log("☕ NPC AI Server running on port 3000");
});
