import express from 'express';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI, GenerateVideosOperation } from '@google/genai';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(express.json({ limit: '50mb' }));

const port = process.env.PORT || 3000;

// Initialize Gemini SDK
// Fails gracefully if key gets accessed. We do lazy init in endpoints instead.
function getAi() {
  const key = process.env.GEMINI_API_KEY;
  if (!key) {
    throw new Error('GEMINI_API_KEY environment variable is required');
  }
  return new GoogleGenAI({ apiKey: key });
}

// 1. Generate Image Endpoint
app.post('/api/generate-image', async (req, res) => {
  try {
    const ai = getAi();
    const { prompt, aspectRatio } = req.body;
    
    // Create an interaction to generate an image
    const interaction = await ai.interactions.create({
      model: 'gemini-3.1-flash-image-preview',
      input: prompt,
      response_modalities: ['image', 'text'],
      generation_config: {
        image_config: {
          aspect_ratio: aspectRatio || "9:16",
          image_size: "1K"
        },
      },
    });

    let imageUrl = '';
    for (const step of interaction.steps) {
      if (step.type === 'model_output') {
        const imageContent = step.content?.find(c => c.type === 'image');
        if (imageContent && imageContent.data) {
          const base64EncodeString = imageContent.data;
          const mimeType = imageContent.mime_type || 'image/png';
          imageUrl = `data:${mimeType};base64,${base64EncodeString}`;
        }
      }
    }

    if (!imageUrl) {
      throw new Error("Failed to generate image.");
    }

    res.json({ imageUrl });

  } catch (error: any) {
    console.error("Image generation error:", error);
    res.status(500).json({ error: error.message || 'Failed to generate image' });
  }
});

// 2. Start Video Generation Endpoint
app.post('/api/generate-video', async (req, res) => {
  try {
    const ai = getAi();
    const { prompt, imageBase64, aspectRatio } = req.body;

    // Extract original mime type from data URL instead of hardcoding
    const mimeMatch = imageBase64.match(/^data:(image\/\w+);base64,/);
    const mimeType = mimeMatch ? mimeMatch[1] : 'image/jpeg';
    const base64Data = imageBase64.replace(/^data:image\/\w+;base64,/, "");

    const operation = await ai.models.generateVideos({
      model: 'veo-3.1-lite-generate-preview',
      prompt: prompt || 'A subtle natural movement',
      image: {
        imageBytes: base64Data,
        mimeType: mimeType, 
      },
      config: {
        numberOfVideos: 1,
        resolution: '1080p',
        aspectRatio: aspectRatio || '9:16'
      }
    });

    res.json({ operationName: operation.name });

  } catch (error: any) {
    console.error("Video generation start error:", error);
    res.status(500).json({ error: error.message || 'Failed to start video generation' });
  }
});

// 3. Poll Video Status
app.post('/api/video-status', async (req, res) => {
  try {
    const ai = getAi();
    const { operationName } = req.body;

    const op = new GenerateVideosOperation();
    op.name = operationName;
    const updated = await ai.operations.getVideosOperation({ operation: op });
    
    res.json({ done: updated.done });

  } catch (error: any) {
    console.error("Video polling error:", error);
    res.status(500).json({ error: error.message || 'Failed to check video status' });
  }
});

// 4. Download Video
app.post('/api/video-download', async (req, res) => {
  try {
    const ai = getAi();
    const { operationName } = req.body;

    const op = new GenerateVideosOperation();
    op.name = operationName;
    const updated = await ai.operations.getVideosOperation({ operation: op });
    
    const uri = updated.response?.generatedVideos?.[0]?.video?.uri;
    if (!uri) {
      throw new Error("Video URI not found. Ensure video generation is complete.");
    }

    const videoRes = await fetch(uri, {
      headers: { 'x-goog-api-key': process.env.GEMINI_API_KEY as string },
    });
    
    if (!videoRes.body) {
      throw new Error("Failed to fetch video stream");
    }

    res.setHeader('Content-Type', 'video/mp4');
    
    const reader = videoRes.body.getReader();
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      res.write(value);
    }
    res.end();

  } catch (error: any) {
    console.error("Video download error:", error);
    res.status(500).json({ error: error.message || 'Failed to download video' });
  }
});

// Vite/Static Setup
async function startServer() {
  if (process.env.NODE_ENV === 'production') {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (req, res) => {
      res.sendFile(path.resolve(__dirname, 'dist/index.html'));
    });
  } else {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  app.listen(port, () => {
    console.log(`Server started on port ${port}`);
  });
}

startServer();
