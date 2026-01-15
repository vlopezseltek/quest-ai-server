import express from "express";
import multer from "multer";
import OpenAI from "openai";
import fs from "fs";
import cors from "cors";
import { exec } from "child_process";

const app = express();
app.use(cors());

// Railway solo permite escritura en /tmp
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

    const wavPath = req.file.path;
    const mp3Path = wavPath + ".mp3";

    // 🔥 Convertir WAV de Unity → MP3 compatible con OpenAI
    await new Promise((resolve, reject) => {
      exec(
        `ffmpeg -y -i "${wavPath}" -ac 1 -ar 16000 -b:a 128k "${mp3Path}"`,
        (error) => {
          if (error) {
            console.error("FFmpeg error:", error);
            reject(error);
          } else {
            console.log("Audio converted to MP3");
            resolve();
          }
        }
      );
    });

    // 1️⃣ Speech → Text
    const transcript = await openai.audio.transcriptions.create({
      file: fs.createReadStream(mp3Path),
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

    res.setHeader("Content-Type", "audio/wav");
    res.send(buffer);

    // 🧹 Limpiar archivos temporales
    fs.unlinkSync(wavPath);
    fs.unlinkSync(mp3Path);

  } catch (err) {
    console.error("AI ERROR:", err);
    res.status(500).json({ error: err.message });
  }
});

app.listen(3000, () => {
  console.log("☕ NPC AI Server running on port 3000");
});
