'use client';
import { useState } from 'react';
import { getStorage, ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { app } from '@/lib/firebase';

interface Props {
  pathPrefix?: string;
  onDone: (url: string) => void;
}

export default function UploadDropzone({ pathPrefix = 'uploads', onDone }: Props) {
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);

  async function onFile(files?: FileList | null) {
    if (!files || !files[0]) return;
    const file = files[0];
    setUploading(true);

    const storage = getStorage(app);
    const storageRef = ref(storage, `${pathPrefix}/${Date.now()}_${file.name}`);
    const uploadTask = uploadBytesResumable(storageRef, file);

    uploadTask.on('state_changed',
      (snapshot) => {
        const prog = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
        setProgress(prog);
      },
      (error) => {
        console.error('Upload failed:', error);
        alert('Upload failed');
        setUploading(false);
      },
      () => {
        getDownloadURL(uploadTask.snapshot.ref).then((downloadURL) => {
          onDone(downloadURL);
          setUploading(false);
        });
      }
    );
  }

  return (
    <label className="relative flex flex-col items-center justify-center w-full h-24 border-2 border-dashed rounded-lg cursor-pointer bg-neutral-50 hover:bg-neutral-100">
      {uploading ? (
        <div className="text-center">
          <p className="text-sm text-slate-600">Uploading...</p>
          <div className="w-32 mt-2 bg-slate-200 rounded-full h-1.5">
            <div className="bg-emerald-600 h-1.5 rounded-full" style={{ width: `${progress}%` }}></div>
          </div>
        </div>
      ) : (
        <div className="text-center">
          <p className="text-sm text-slate-600">Drag & drop or click to upload</p>
          <p className="text-xs text-slate-500">PNG, JPG, GIF up to 10MB</p>
        </div>
      )}
      <input type="file" className="absolute inset-0 w-full h-full opacity-0" onChange={(e) => onFile(e.target.files)} disabled={uploading} />
    </label>
  );
}
