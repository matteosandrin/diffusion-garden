import type {
  CanvasState,
  CanvasSummary,
  AppSettings,
  TextModel,
  ImageModel,
  Prompts,
  InputContentItem,
  ModelsConfig,
  AppNode,
  CreateJobResponse,
  Job,
} from "../types";

const API_HOST = import.meta.env.VITE_API_HOST || "";
const API_BASE = API_HOST + "/api";

export function addApiHost(url?: string | null): string | null {
  if (!url) return null;
  if (url && url.startsWith(API_HOST)) {
    return url;
  }
  return `${API_HOST}${url}`;
}
const stripApiHost = (url: string): string => {
  if (API_HOST && url.startsWith(API_HOST)) {
    return url.slice(API_HOST.length);
  }
  return url;
};

// Generic fetch wrapper with error handling
async function apiFetch<T>(
  endpoint: string,
  options?: RequestInit,
): Promise<T> {
  const response = await fetch(`${API_BASE}${endpoint}`, {
    headers: {
      "Content-Type": "application/json",
      ...options?.headers,
    },
    ...options,
  });

  if (!response.ok) {
    const error = await response
      .json()
      .catch(() => ({ detail: "Unknown error" }));
    throw new Error(error.detail || `API error: ${response.status}`);
  }

  return response.json();
}

export const canvasApi = {
  list: async () => {
    const response = await apiFetch<CanvasSummary[]>("/canvas");
    return response.map((canvas: CanvasSummary) => ({
      ...canvas,
      thumbnailUrl: addApiHost(canvas.thumbnailUrl),
    })) as unknown as CanvasSummary[];
  },

  create: () => apiFetch<{ id: string }>("/canvas", { method: "POST" }),

  load: async (id: string) => {
    const response = await apiFetch<CanvasState>(`/canvas/${id}`);
    return {
      ...response,
      nodes: response.nodes?.map((node: AppNode) => ({
        ...node,
        data: {
          ...node.data,
          imageUrl: addApiHost(node.data?.imageUrl as string | null),
        },
      })),
    } as CanvasState;
  },

  save: (id: string, state: Partial<CanvasState>) => {
    const newState: Partial<CanvasState> = {
      ...state,
      nodes: state.nodes?.map((node: AppNode) => {
        const data = node.data ? { ...node.data } : undefined;
        if (data && data.type === "image" && data.imageUrl) {
          data.imageUrl = stripApiHost(data.imageUrl);
        }
        return { ...node, data } as AppNode;
      }),
    };

    return apiFetch<{ success: boolean }>(`/canvas/${id}`, {
      method: "PUT",
      body: JSON.stringify(newState),
    });
  },

  delete: (id: string) =>
    apiFetch<{ success: boolean }>(`/canvas/${id}`, { method: "DELETE" }),
};

export const imageApi = {
  upload: async (
    file: File,
  ): Promise<{ imageId: string; imageUrl: string }> => {
    const formData = new FormData();
    formData.append("file", file);

    const response = await fetch(`${API_BASE}/images/upload`, {
      method: "POST",
      body: formData,
    });

    if (!response.ok) {
      const error = await response
        .json()
        .catch(() => ({ detail: "Upload failed" }));
      throw new Error(error.detail || "Upload failed");
    }

    const data = await response.json();
    data.imageUrl = addApiHost(data.imageUrl) ?? "";
    return data;
  },
};

export const settingsApi = {
  get: () => apiFetch<AppSettings>("/settings"),

  update: (settings: Partial<AppSettings>) =>
    apiFetch<AppSettings>("/settings", {
      method: "PUT",
      body: JSON.stringify(settings),
    }),

  checkApiKeys: () =>
    apiFetch<{ openai: boolean; google: boolean }>("/settings/api-keys/status"),

  getPrompts: () => apiFetch<Prompts>("/settings/prompts"),

  getModels: () => apiFetch<ModelsConfig>("/settings/models"),
};

export interface JobStreamCallbacks {
  onChunk?: (text: string) => void;
  onDone: (result: {
    text?: string;
    imageId?: string;
    imageUrl?: string;
  }) => void;
  onError: (error: string) => void;
  onCancelled?: () => void;
}

export const jobsApi = {
  createTextJob: async (
    blockId: string,
    prompt: string,
    input: InputContentItem[] | undefined,
    model: TextModel,
  ): Promise<CreateJobResponse> => {
    const textInput = input
      ?.filter((item) => item.type === "text")
      .map((item) => item.content)
      .join("\n\n");
    const imageUrls = input
      ?.filter((item) => item.type === "image")
      .map((item) => item.url);

    return await apiFetch<CreateJobResponse>("/jobs/generate-text", {
      method: "POST",
      body: JSON.stringify({
        block_id: blockId,
        prompt,
        input: textInput,
        image_urls: imageUrls,
        model,
      }),
    });
  },

  createImageJob: async (
    blockId: string,
    prompt: string,
    input: InputContentItem[] | undefined,
    model: ImageModel,
    isVariation: boolean = false,
  ): Promise<CreateJobResponse> => {
    const imageUrls = input
      ?.filter((item) => item.type === "image")
      .map((item) => item.url);

    return await apiFetch<CreateJobResponse>("/jobs/generate-image", {
      method: "POST",
      body: JSON.stringify({
        block_id: blockId,
        prompt,
        image_urls: imageUrls,
        model,
        is_variation: isVariation,
      }),
    });
  },

  subscribeToJob: (
    jobId: string,
    callbacks: JobStreamCallbacks,
  ): (() => void) => {
    const eventSource = new EventSource(`${API_BASE}/jobs/${jobId}/stream`);

    eventSource.addEventListener("chunk", (event) => {
      const data = JSON.parse(event.data);
      callbacks.onChunk?.(data.text);
    });

    eventSource.addEventListener("done", (event) => {
      const data = JSON.parse(event.data);
      const result = data.result;
      if (result.imageUrl) {
        result.imageUrl = addApiHost(result.imageUrl) ?? "";
      }
      callbacks.onDone(result);
      eventSource.close();
    });

    eventSource.addEventListener("error", (event) => {
      if (event instanceof MessageEvent) {
        const data = JSON.parse(event.data);
        callbacks.onError(data.error);
      } else {
        callbacks.onError("Connection error");
      }
      eventSource.close();
    });

    eventSource.addEventListener("cancelled", () => {
      callbacks.onCancelled?.();
      eventSource.close();
    });

    eventSource.onerror = () => {
      // Only report error if the connection was not intentionally closed
      if (eventSource.readyState === EventSource.CLOSED) {
        return;
      }
      callbacks.onError("Connection lost");
      eventSource.close();
    };

    // Return a cleanup function to close the connection
    return () => {
      eventSource.close();
    };
  },

  cancelJob: (jobId: string) =>
    apiFetch<{ success: boolean }>(`/jobs/${jobId}/cancel`, {
      method: "POST",
    }),

  getJob: (jobId: string) => apiFetch<Job>(`/jobs/${jobId}`),

  getJobsForBlock: (blockId: string) =>
    apiFetch<Job[]>(`/jobs/block/${blockId}`),
};

export interface DailyStats {
  date: string;
  request_type: string;
  request_count: number;
  input_tokens: number;
  output_tokens: number;
  total_tokens: number;
}

export interface DailyStatsResponse {
  stats: DailyStats[];
}

export const analyticsApi = {
  getDaily: (timezone?: string) => {
    const url = timezone
      ? `/analytics/daily?timezone=${encodeURIComponent(timezone)}`
      : "/analytics/daily";
    return apiFetch<DailyStatsResponse>(url);
  },
};

export const notifyApi = {
  notify: (path: string, referrer?: string | null, ip?: string | null) =>
    apiFetch<{ status: string }>("/notify", {
      method: "POST",
      body: JSON.stringify({
        path,
        referrer: referrer || null,
        ip: ip || null,
      }),
    }),
};
