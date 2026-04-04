"use client";

import { useCallback, useState } from "react";
import { ImagePlus } from "lucide-react";
import { cn } from "@/lib/utils";

type ImageUploaderProps = {
  label?: string;
  className?: string;
  onFilesSelected?: (files: FileList | null) => void;
};

export function ImageUploader({
  label = "Property photos",
  className,
  onFilesSelected,
}: ImageUploaderProps) {
  const [drag, setDrag] = useState(false);

  const onChange = useCallback(
    (files: FileList | null) => {
      onFilesSelected?.(files);
    },
    [onFilesSelected],
  );

  return (
    <div className={cn("w-full", className)}>
      <p className="mb-2 text-sm font-medium text-stone-800 dark:text-stone-200">{label}</p>
      <label
        className={cn(
          "flex cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-stone-200 bg-stone-50/50 px-6 py-12 text-center transition hover:border-stone-300 hover:bg-stone-50 dark:border-stone-800 dark:bg-stone-900/40 dark:hover:border-stone-700 dark:hover:bg-stone-900/60",
          drag && "border-stone-400 bg-stone-100 dark:border-stone-500 dark:bg-stone-900",
        )}
        onDragEnter={() => setDrag(true)}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDrag(false);
          onChange(e.dataTransfer.files);
        }}
        onDragOver={(e) => e.preventDefault()}
      >
        <span className="flex h-12 w-12 items-center justify-center rounded-full bg-white shadow-sm ring-1 ring-stone-200 dark:bg-stone-950 dark:ring-stone-800">
          <ImagePlus className="h-6 w-6 text-stone-500" aria-hidden />
        </span>
        <span className="text-sm font-medium text-stone-800 dark:text-stone-200">
          Drop images or browse
        </span>
        <span className="text-xs text-stone-500 dark:text-stone-400">
          PNG, JPG, HEIC up to 25MB · connects to storage next
        </span>
        <input
          type="file"
          accept="image/*"
          multiple
          className="sr-only"
          onChange={(e) => onChange(e.target.files)}
        />
      </label>
    </div>
  );
}
