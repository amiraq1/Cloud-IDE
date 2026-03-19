import Fastify from "fastify";
import cors from "@fastify/cors";
import { Server } from "socket.io";
import type { RuntimeBridge, RunRequest } from "./runtime.js";
import { createDockerRuntimeController } from "./docker.js";

const app = Fastify({
  logger: false
});

await app.register(cors, {
  origin: true
});

app.get("/api/health", async () => ({
  ok: true
}));

app.get("/api/session", async () => ({
  projectName: "Basalt Control Room",
  description: "Cloud IDE starter with Docker execution adapter.",
  runner: "docker-pty",
  transport: "socket.io",
  features: [
    "Monaco workspace models",
    "Socket runtime bridge",
    "Interactive stdin stub",
    "Docker adapter seam"
  ]
}));

const SYSTEM_PROMPT = `أنت مهندس واجهات أمامية طليعي (Avant-Garde UI Designer).
مهمتك توليد شجرة ملفات (FileTree) كاملة لمشروع ويب مبني بـ React (TSX) استجابة لوصف المستخدم.
- يجب أن يكون الجذر عبارة عن مجلد واحد يحتوي بداخله جميع ملفات المشروع.
- قم بكتابة CSS عصري وغير نمطي مع مؤثرات Glassmorphism وعناصر تباعد فاخرة.
- ركز على استخدام 'lucide-react' للأيقونات.
- المخرج يجب أن يكون JSON Array صالح ومطابق للهيكل.
لا تضع أي نصوص كتعليق خارج مصفوفة الـ JSON.`;

app.post("/api/generate", async (request, reply) => {
  try {
    const { prompt } = request.body as any;
    if (!prompt) return reply.code(400).send({ error: "Missing prompt" });

    // Use hardcoded key from the user's setup or process.env
    const apiKey = process.env.NVIDIA_API_KEY || "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";
    const apiUrl = "https://integrate.api.nvidia.com/v1/chat/completions";
    const modelToUse = "meta/llama-3.1-70b-instruct";

    const llmResponse = await fetch(apiUrl, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: modelToUse,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: `قم ببناء بيئة عمل للمتطلبات التالية: ${prompt}` }
        ],
        temperature: 0.2,
        max_tokens: 4000,
        response_format: { type: "json_object" }
      })
    });

    if (!llmResponse.ok) {
      throw new Error(await llmResponse.text());
    }

    const llmData = await llmResponse.json();
    let fileTreeContent = llmData.choices[0]?.message?.content || "[]";
    
    // Parse the result safely
    let parsedTree: any[] = [];
    try {
      const parsed = JSON.parse(fileTreeContent);
      if (Array.isArray(parsed)) {
        parsedTree = parsed;
      } else if (parsed.fileTree && Array.isArray(parsed.fileTree)) {
        parsedTree = parsed.fileTree;
      } else if (parsed.files && Array.isArray(parsed.files)) {
        parsedTree = parsed.files;
      } else if (typeof parsed === 'object') {
        parsedTree = [parsed];
      }
    } catch(e) {
      console.error("JSON parse error:", e);
      parsedTree = [];
    }

    // Code Sanitizer Helper for LLM markdown artifacts
    function sanitizeContent(code?: string): string | undefined {
      if (typeof code !== "string") return code;
      
      let clean = code;
      // Strip markdown code block wrappings sometimes leaked inside JSON
      const markdownRegex = /^```[\w-]*\n([\s\S]*?)\n```$/gm;
      const match = markdownRegex.exec(clean.trim());
      if (match && match[1]) {
        clean = match[1];
      } else {
        // Fallback for dangling code blocks
        clean = clean.replace(/^```[\w-]*\n?/g, "").replace(/\n?```$/g, "");
      }
      
      // Auto-fix some known React syntax/import hallucinations
      clean = clean.replace(/import\s+React.*?;\n/g, ""); // Modern React doesn't need 'import React'
      
      return clean.trim() === "" ? code : clean;
    }

    // Recursively inject 'id', 'createdAt', 'modifiedAt' and sanitize logic
    let idCounter = 1;
    function finalizeTree(nodes: any[]): any[] {
      return nodes.map(node => {
        const id = node.id || `node-${Date.now()}-${idCounter++}-${Math.random().toString(36).slice(2, 6)}`;
        return {
          ...node,
          id,
          type: node.type || (node.children ? 'folder' : 'file'),
          createdAt: Date.now(),
          modifiedAt: Date.now(),
          content: sanitizeContent(node.content),
          children: node.children && Array.isArray(node.children) ? finalizeTree(node.children) : undefined,
        };
      });
    }

    const finalTree = finalizeTree(parsedTree);

    return reply.send({ fileTree: finalTree });
  } catch (err: any) {
    console.error("LLM Generation Error:", err);
    return reply.code(500).send({ error: "Failed to generate plan: " + err.message });
  }
});

const runtime = createDockerRuntimeController();

function formatTerminalLine(payload: { kind: "stdout" | "stderr" | "system" | "stdin"; text: string; raw?: boolean }) {
  if (payload.raw) {
    return payload.text;
  }

  let prefix = "";

  switch (payload.kind) {
    case "system":
      prefix = "\x1b[34m[sys]\x1b[0m ";
      break;
    case "stderr":
      prefix = "\x1b[31;1m[err]\x1b[0m ";
      break;
    case "stdin":
      prefix = "\x1b[35m[in]\x1b[0m ";
      break;
    case "stdout":
    default:
      prefix = "\x1b[32m[out]\x1b[0m ";
      break;
  }

  return `${prefix}${payload.text}${/[\r\n]$/.test(payload.text) ? "" : "\r\n"}`;
}

const io = new Server(app.server, {
  cors: {
    origin: true
  }
});

io.on("connection", (socket) => {
  const bridge: RuntimeBridge = {
    emitFeed: (payload) => {
      socket.emit("runtime:feed", payload);
    },
    emitLine: (payload) => {
      socket.emit("pty:data", { data: formatTerminalLine(payload) });
    },
    emitStatus: (payload) => {
      socket.emit("runtime:status", payload);
    }
  };

  bridge.emitLine({
    kind: "system",
    text: "\r\n\x1b[36m* Cloud IDE Core attached.\x1b[0m\r\n",
    raw: true
  });
  bridge.emitStatus({
    status: "idle",
    detail: "تم الاتصال: Sandbox جاهز"
  });

  socket.on("runtime:run", (payload: Partial<RunRequest>) => {
    const request: RunRequest = {
      code: payload.code ?? "",
      fileName: payload.fileName ?? "scratch.ts",
      language: payload.language ?? "typescript"
    };

    Promise.resolve(runtime.run(socket.id, request, bridge)).catch((error) => {
      bridge.emitLine({
        kind: "stderr",
        text: `Runner failure: ${error instanceof Error ? error.message : String(error)}`
      });
      bridge.emitStatus({ status: "idle", detail: "Runner failed" });
    });
  });

  socket.on("terminal:input", (payload: { data?: string }) => {
    runtime.receiveInput(socket.id, payload.data ?? "", bridge);
  });

  socket.on("disconnect", () => {
    void Promise.resolve(runtime.disconnect(socket.id));
  });
});

const port = Number(process.env.PORT ?? 8787);

try {
  await app.listen({
    host: "0.0.0.0",
    port
  });

  console.log(`cloud-ide server listening on http://localhost:${port}`);
} catch (error) {
  console.error("FATAL ERROR BOOTING SERVER:", error);
  process.exit(1);
}
