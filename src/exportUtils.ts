/**
 * Cross-platform Export Utility for Web and Capacitor Android / iOS APK
 * Supports:
 * 1. Web Share API (native Android/iOS file save & share sheets)
 * 2. Standard Browser Blob Download (<a download>)
 * 3. Data URI fallback
 * 4. Clipboard copy fallback
 */

export interface ExportFileParams {
  fileName: string;
  content: string;
  mimeType?: string;
  title?: string;
}

export interface ExportResult {
  success: boolean;
  method: 'share' | 'download' | 'clipboard' | 'data-uri';
  fileName: string;
  fileSizeKb: string;
  message: string;
}

export async function exportFile({
  fileName,
  content,
  mimeType = 'application/json;charset=utf-8;',
  title = 'TutorTrack Data Export'
}: ExportFileParams): Promise<ExportResult> {
  const blob = new Blob([content], { type: mimeType });
  const sizeKb = (blob.size / 1024).toFixed(1);

  // Strategy 1: Mobile Web Share API with File object (Supported in Android WebView / Mobile Browsers)
  if (typeof navigator !== 'undefined' && typeof File !== 'undefined' && navigator.share && navigator.canShare) {
    try {
      const file = new File([blob], fileName, { type: mimeType });
      if (navigator.canShare({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: title,
          text: `Exported ${fileName} from TutorTrack`
        });
        return {
          success: true,
          method: 'share',
          fileName,
          fileSizeKb: sizeKb,
          message: `✓ Exported "${fileName}" (${sizeKb} KB) via device share dialog.`
        };
      }
    } catch (err: any) {
      // If user aborted/cancelled the share sheet, return clean status without error
      if (err?.name === 'AbortError') {
        return {
          success: true,
          method: 'share',
          fileName,
          fileSizeKb: sizeKb,
          message: `Share sheet closed for "${fileName}".`
        };
      }
      // If share failed, continue to fallback strategies below
      console.warn('Navigator share file failed, falling back to download:', err);
    }
  }

  // Strategy 2: Standard Blob Object URL Download
  try {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', fileName);
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();
    
    // Clean up with short timeout to ensure Android WebView / Safari executes click
    setTimeout(() => {
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    }, 1000);

    return {
      success: true,
      method: 'download',
      fileName,
      fileSizeKb: sizeKb,
      message: `✓ Export file generated: "${fileName}" (${sizeKb} KB)`
    };
  } catch (blobErr) {
    console.warn('Blob URL download failed, trying data URI fallback:', blobErr);
  }

  // Strategy 3: Data URI fallback for constrained environments
  try {
    const encodedData = encodeURIComponent(content);
    const dataUri = `data:${mimeType},${encodedData}`;
    const link = document.createElement('a');
    link.href = dataUri;
    link.setAttribute('download', fileName);
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();
    setTimeout(() => {
      document.body.removeChild(link);
    }, 1000);

    return {
      success: true,
      method: 'data-uri',
      fileName,
      fileSizeKb: sizeKb,
      message: `✓ Exported "${fileName}" (${sizeKb} KB)`
    };
  } catch (dataErr) {
    console.warn('Data URI failed, falling back to clipboard:', dataErr);
  }

  // Strategy 4: Clipboard copy fallback
  try {
    if (navigator?.clipboard?.writeText) {
      await navigator.clipboard.writeText(content);
      return {
        success: true,
        method: 'clipboard',
        fileName,
        fileSizeKb: sizeKb,
        message: `✓ Export content for "${fileName}" (${sizeKb} KB) copied to clipboard.`
      };
    }
  } catch (clipErr) {
    console.error('All export methods failed:', clipErr);
  }

  return {
    success: false,
    method: 'download',
    fileName,
    fileSizeKb: sizeKb,
    message: `Export could not be completed on this platform.`
  };
}

/**
 * Helper to copy string to clipboard across all browsers
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  if (navigator?.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      // fallback below
    }
  }
  try {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.select();
    const success = document.execCommand('copy');
    document.body.removeChild(textarea);
    return success;
  } catch {
    return false;
  }
}
