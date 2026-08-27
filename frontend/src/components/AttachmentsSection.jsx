import { useCallback, useEffect, useState } from 'react';

import { getAttachments, uploadAttachment, deleteAttachment, downloadAttachment } from '../services/attachments';

const formatSize = (bytes) => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

function AttachmentsSection({ memoId, canUpload, currentUserId, isAuthor }) {
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
    } catch (uploadErr) {
      setUploadError(uploadErr.response?.data?.message || 'Failed to upload file');
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
    } catch (deleteError) {
      setError(deleteError.response?.data?.message || 'Failed to delete attachment');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <p className="text-sm font-medium text-gray-700">Attachments</p>

      {error && <p className="mt-1 text-sm text-red-600">{error}</p>}

      <div className="mt-1 space-y-2">
        {loading ? (
          <p className="text-sm text-gray-400">Loading attachments...</p>
        ) : attachments.length === 0 ? (
          <p className="text-sm text-gray-400">No attachments yet.</p>
        ) : (
          attachments.map((attachment) => {
            const canDelete = isAuthor || attachment.uploadedBy?._id === currentUserId;
            return (
              <div
                key={attachment._id}
                className="flex items-center justify-between rounded border border-gray-200 p-3 text-sm"
              >
                <div>
                  <button
                    type="button"
                    onClick={() => handleDownload(attachment)}
                    className="font-medium text-blue-600 hover:underline"
                  >
                    {attachment.filename}
                  </button>
                  <p className="mt-0.5 text-xs text-gray-500">
                    {formatSize(attachment.size)} &middot; {attachment.uploadedBy?.name || 'Unknown'} &middot;{' '}
                    {new Date(attachment.uploadedAt).toLocaleString()}
                  </p>
                </div>
                {canDelete && (
                  <button
                    type="button"
                    onClick={() => handleDelete(attachment)}
                    disabled={busy}
                    className="text-xs text-red-600 hover:underline disabled:opacity-50"
                  >
                    Delete
                  </button>
                )}
              </div>
            );
          })
        )}
      </div>

      {canUpload && (
        <div className="mt-3">
          {uploadError && <p className="mb-1 text-sm text-red-600">{uploadError}</p>}
          <label className="inline-block cursor-pointer rounded bg-gray-700 px-3 py-1.5 text-sm font-medium text-white hover:bg-gray-600">
            {busy ? 'Uploading...' : 'Upload File'}
            <input type="file" onChange={handleFileChange} disabled={busy} className="hidden" />
          </label>
          <p className="mt-1 text-xs text-gray-400">PDF, Word, Excel, PNG, or JPEG — up to 10MB.</p>
        </div>
      )}
    </div>
  );
}

export default AttachmentsSection;
