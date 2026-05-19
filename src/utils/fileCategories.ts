export type FileCategory = "directory" | "document" | "spreadsheet" | "image" | "audio" | "video" | "archive" | "code" | "file";

const extensionMap: Record<string, FileCategory> = {
  pdf: "document", doc: "document", docx: "document", txt: "document", md: "document", rtf: "document", odt: "document",
  xls: "spreadsheet", xlsx: "spreadsheet", csv: "spreadsheet", ods: "spreadsheet",
  jpg: "image", jpeg: "image", png: "image", gif: "image", webp: "image", svg: "image", bmp: "image",
  mp3: "audio", wav: "audio", ogg: "audio", flac: "audio", aac: "audio", m4a: "audio",
  mp4: "video", avi: "video", mkv: "video", mov: "video", wmv: "video", flv: "video", webm: "video",
  zip: "archive", rar: "archive", "7z": "archive", tar: "archive", gz: "archive",
  js: "code", ts: "code", py: "code", html: "code", css: "code", json: "code", xml: "code", yaml: "code", yml: "code", sh: "code", rs: "code", go: "code",
};

export function getFileCategory(name: string, type: "file" | "directory"): FileCategory {
  if (type === "directory") return "directory";
  const ext = name.split(".").pop()?.toLowerCase() ?? "";
  return extensionMap[ext] ?? "file";
}
