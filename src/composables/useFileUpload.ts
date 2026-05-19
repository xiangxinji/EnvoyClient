import { ref } from "vue";
import type { MessageAttachment } from "../types";
import { isImageMime, compressImage } from "../utils/imageCompress";
import { apiUrl } from "../api";

export interface PendingFileAttachment {
  file: File;
}

export function useFileUpload(myId: string, teamName: string) {
  const pendingFiles = ref<PendingFileAttachment[]>([]);
  const uploading = ref(false);
  const attachmentError = ref("");

  function handlePickAttachment(insertImage: (file: File) => void) {
    const input = document.createElement("input");
    input.type = "file";
    input.multiple = true;
    input.onchange = async () => {
      const files = Array.from(input.files ?? []);
      for (const file of files) {
        if (file.type.startsWith("image/")) {
          insertImage(file);
        } else {
          pendingFiles.value.push({ file });
        }
      }
    };
    input.click();
  }

  function removeFile(index: number) {
    pendingFiles.value.splice(index, 1);
  }

  async function uploadImages(images: { blob: Blob; name: string }[]): Promise<MessageAttachment[]> {
    const attachments: MessageAttachment[] = [];
    for (const img of images) {
      let blobToSend: Blob = img.blob;
      if (isImageMime(img.blob.type)) {
        const result = await compressImage(img.blob instanceof File ? img.blob : new File([img.blob], img.name));
        blobToSend = result.blob;
      }

      const formData = new FormData();
      formData.append("file", blobToSend, img.name);
      formData.append("from", myId);

      const res = await fetch(apiUrl("/api/messages/attachments"), {
        method: "POST",
        headers: { team: teamName },
        body: formData,
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Upload failed" }));
        throw new Error(err.error ?? "Upload failed");
      }

      const data = await res.json() as MessageAttachment;
      data.url = apiUrl(data.url);
      attachments.push(data);
    }
    return attachments;
  }

  async function uploadPendingFiles(): Promise<MessageAttachment[]> {
    const attachments: MessageAttachment[] = [];
    for (const att of pendingFiles.value) {
      const formData = new FormData();
      formData.append("file", att.file, att.file.name);
      formData.append("from", myId);

      const res = await fetch(apiUrl("/api/messages/attachments"), {
        method: "POST",
        headers: { team: teamName },
        body: formData,
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Upload failed" }));
        throw new Error(err.error ?? "Upload failed");
      }

      const data = await res.json() as MessageAttachment;
      data.url = apiUrl(data.url);
      attachments.push(data);
    }
    pendingFiles.value = [];
    return attachments;
  }

  return {
    pendingFiles,
    uploading,
    attachmentError,
    handlePickAttachment,
    removeFile,
    uploadImages,
    uploadPendingFiles,
  };
}
