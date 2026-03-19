import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { corsHeaders } from '../_shared/cors.ts'

// JSON Schema للمخرج المطلوب (مصفوفة FileNode)
const schema = {
  type: "array",
  items: {
    type: "object",
    properties: {
      id: { type: "string" },
      name: { type: "string" },
      type: { type: "string", enum: ["folder", "file"] },
      language: { type: "string", enum: ["typescript", "typescriptreact", "javascript", "css", "json", "markdown", "html", "bash", "python"] },
      content: { type: "string" },
      children: { 
        type: "array",
        items: { "$ref": "#" } // Recursive reference for sub-files
      }
    },
    required: ["id", "name", "type"]
  }
};

const SYSTEM_PROMPT = `أنت مهندس واجهات أمامية طليعي (Avant-Garde UI Designer).
مهمتك توليد شجرة ملفات (FileTree) كاملة لمشروع ويب مبني بـ React (TSX) استجابة لوصف المستخدم.
- يجب أن يكون الجذر عبارة عن مجلد واحد يحتوي بداخله جميع ملفات المشروع.
- قم بكتابة CSS عصري وغير نمطي مع مؤثرات Glassmorphism وعناصر تباعد فاخرة.
- ركز على استخدام 'lucide-react' للأيقونات.
- المخرج يجب أن يكون JSON Array صالح ومطابق للهيكل.
لا تضع أي نصوص كتعليق خارج مصفوفة الـ JSON.`;

Deno.serve(async (req) => {
  // 1. Handle CORS Preflight (OPTIONS)
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { prompt } = await req.json()

    if (!prompt) {
      throw new Error("Missing 'prompt' in request body")
    }

    // You can use process.env.NVIDIA_API_KEY or SUPABASE secrets
    // The previous context showed the user used an NVIDIA LLM key
    const apiKey = Deno.env.get("NVIDIA_API_KEY") || Deno.env.get("OPENAI_API_KEY");
    
    if (!apiKey) {
      throw new Error("API Key isn't configured in Edge Function environment.");
    }

    const apiUrl = Deno.env.get("NVIDIA_API_KEY") 
      ? "https://integrate.api.nvidia.com/v1/chat/completions" 
      : "https://api.openai.com/v1/chat/completions";

    const modelToUse = Deno.env.get("NVIDIA_API_KEY") 
      ? "meta/llama-3.1-70b-instruct" 
      : "gpt-4o";

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
        response_format: { type: "json_object" } // Enforce JSON
      })
    });

    if (!llmResponse.ok) {
      const errorText = await llmResponse.text();
      console.error("LLM Error:", errorText);
      throw new Error("فشل الاتصال بنموذج الذكاء الاصطناعي");
    }

    const llmData = await llmResponse.json();
    let fileTreeContent = llmData.choices[0]?.message?.content || "[]";
    
    // Fallback parser in case LLM wraps response in JSON object
    try {
      const parsed = JSON.parse(fileTreeContent);
      if (!Array.isArray(parsed) && parsed.fileTree) {
         fileTreeContent = JSON.stringify(parsed.fileTree);
      } else if (!Array.isArray(parsed) && parsed.files) {
         fileTreeContent = JSON.stringify(parsed.files);
      } else if (!Array.isArray(parsed)) {
         // Force wrap object in array if single root folder returned
         fileTreeContent = JSON.stringify([parsed]);
      }
    } catch(e) { /* ignore */ }

    // Return the response
    return new Response(
      JSON.stringify({ fileTree: JSON.parse(fileTreeContent) }), 
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );

  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 400,
    })
  }
})
