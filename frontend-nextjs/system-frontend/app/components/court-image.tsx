"use client";

import Image from "next/image";
import { useState } from "react";
import type { Court } from "../types/court";
import CourtArtwork from "./court-artwork";

type CourtImageProps = {
  src?: string;
  alt: string;
  variant: Court["artwork"];
  className?: string;
};

export default function CourtImage({ src, alt, variant, className = "" }: CourtImageProps) {
  const [imageFailed, setImageFailed] = useState(false);
  const showFallback = !src || imageFailed;

  return (
    <div className={`relative isolate overflow-hidden ${className}`}>
      {showFallback ? (
        <CourtArtwork variant={variant} className="absolute inset-0 h-full w-full" />
      ) : (
        <Image
          src={src}
          alt={alt}
          fill
          sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
          className="object-cover"
          onError={() => setImageFailed(true)}
        />
      )}
    </div>
  );
}
