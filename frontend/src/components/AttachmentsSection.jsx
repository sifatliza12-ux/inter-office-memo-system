import { useCallback, useEffect, useState } from 'react';

import { getAttachments, uploadAttachment, deleteAttachment, downloadAttachment } from '../services/attachments';
import { useToast } from '../context/ToastContext.jsx';
import Skeleton from './ui/Skeleton.jsx';
import EmptyState from './ui/EmptyState.jsx';
import { PaperclipIcon, DownloadIcon } from './icons.jsx';

const formatSize = (bytes) => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

function AttachmentCardSkeleton() {
  return (
    <div className="flex items-start gap-3 rounded-lg border border-stone-200 bg-white p-3">
      <Skeleton className="h-9 w-9 shrink-0 rounded-md" />
      <div className="flex-1 space-y-1.5">
        <Skeleton className="h-3.5 w-2/3" />
        <Skeleton className="h-2.5 w-1/3" />
      </div>
    </div>
  );
}

function AttachmentsSection({ memoId, canUpload, currentUserId, isAuthor }) {
  const toast = useToast();
  const [attachments, setAttachments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [uploadError, setUploadError] = useState('');
  const [busy, setBusy] = useState(false);

  const fetchAttachments = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const { data } = await getAttachments(memoId);
      setAttachments(data.attachments);
    } catch (fetchError) {
      setError(fetchError.response?.data?.message || 'Failed to load attachments');
    } finally {
      setLoading(false);
    }
  }, [memoId]);

  useEffect(() => {
    fetchAttachments();
  }, [fetchAttachments]);

  const handleFileChange = async (event) => {
    const file = event.target.files[0];
    event.target.value = '';
    if (!file) {
      return;
    }

    setUploadError('');
    setBusy(true);
    try {
      await uploadAttachment(memoId, file);
      await fetchAttachments();
      toast.success('Attachment uploaded');
    } catch (uploadErr) {
      const message = uploadErr.response?.data?.message || 'Failed to upload file';
      setUploadError(message);
      toast.error(message);
    } finally {
      setBusy(false);
    }
  };

  const handleDownload = async (attachment) => {
    try {
      await downloadAttachment(memoId, attachment._id, attachment.filename);
    } catch (downloadError) {
      setError(downloadError.response?.data?.message || 'Failed to download file');
    }
  };

  const handleDelete = async (attachment) => {
    setBusy(true);
    try {
      await deleteAttachment(memoId, attachment._id);
      await fetchAttachments();
      toast.success('Attachment removed');
    } catch (deleteError) {
      const message = deleteError.response?.data?.message || 'Failed to delete attachment';
      setError(message);
      toast.error(message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <p className="text-sm font-semibold text-stone-800">Attachments</p>

      {error && <p className="mt-1 text-sm text-red-600">{error}</p>}

      <div className="mt-3">
        {loading ? (
          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
            <AttachmentCardSkeleton />
            <AttachmentCardSkeleton />
          </div>
        ) : attachments.length === 0 ? (
          <EmptyState title="No attachments yet" message="Files added to this memo will appear here." className="py-6" />
        ) : (
          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
            {attachments.map((attachment) => {
              const canDelete = isAuthor || attachment.uploadedBy?._id === currentUserId;
              return (
                <div
                  key={attachment._id}
                  className="flex items-start gap-3 rounded-lg border border-stone-200 bg-white p-3 transition-colors hover:border-plum-200"
                >
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-plum-50 text-plum-600">
                    <PaperclipIcon className="h-[18px] w-[18px]" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-stone-800" title={attachment.filename}>
                      {attachment.filename}
                    </p>
                    <p className="mt-0.5 text-xs text-stone-400">
                      {formatSize(attachment.size)} &middot; {attachment.uploadedBy?.name || 'Unknown'}
                    </p>
                    <div className="mt-1.5 flex items-center gap-3">
                      <button
                        type="button"
                        onClick={() => handleDownload(attachment)}
                        className="inline-flex items-center gap-1 text-xs font-semibold text-plum-700 hover:underline"
                      >
                        <DownloadIcon className="h-3 w-3" /> Download
                      </button>
                      {canDelete && (
                        <button
                          type="button"
                          onClick={() => handleDelete(attachment)}
                          disabled={busy}
                          className="text-xs font-medium text-red-600 hover:underline disabled:opacity-50"
                        >
                          Delete
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {canUpload && (
        <div className="mt-3">
          {uploadError && <p className="mb-1 text-sm text-red-600">{uploadError}</p>}
          <label className="inline-flex cursor-pointer items-center rounded-lg bg-plum-800 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-plum-700">
            {busy ? 'Uploading...' : 'Upload File'}
            <input type="file" onChange={handleFileChange} disabled={busy} className="hidden" />
          </label>
          <p className="mt-1 text-xs text-stone-400">PDF, Word, Excel, PNG, or JPEG — up to 10MB.</p>
        </div>
      )}
    </div>
  );
}

export default AttachmentsSection;
