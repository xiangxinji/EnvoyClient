import { ref } from "vue";
import type { MessageAttachment } from "../types";
import { isImageMime, compressImage } from "../utils/imageCompress";
import { pickFiles } from "../utils/filePicker";
import { getMessageService } from "./teamClientContext";

export interface PendingFileAttachment {
  file: File;
}

export function useFileUpload(_myId: string, _teamName: string) {
  const pendingFiles = ref<PendingFileAttachment[]>([]);
  const uploading = ref(false);
  const attachmentError = ref("");

  async function handlePickAttachment(insertImage: (file: File) => void) {
    const files = await pickFiles({ multiple: true });
    for (const file of files) {
      if (file.type.startsWith("image/")) {
        insertImage(file);
      } else {
        pendingFiles.value.push({ file });
      }
    }
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
      const file = new File([blobToSend], img.name, { type: blobToSend.type });
      const data = await getMessageService().uploadAttachment(file);
      attachments.push(data);
    }
    return attachments;
  }

  async function uploadPendingFiles(): Promise<MessageAttachment[]> {
    const attachments: MessageAttachment[] = [];
    for (const att of pendingFiles.value) {
      const data = await getMessageService().uploadAttachment(att.file);
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
