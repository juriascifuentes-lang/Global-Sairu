import { supabase } from "./supabase"

const BUCKET = "trade-images"

function generatePath() {
  return `${Date.now()}-${Math.random().toString(36).slice(2)}.jpg`
}

async function compressFileToBlob(file) {
  return new Promise((resolve) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      const img = new Image()
      img.onload = () => {
        const ratio = Math.min(1400 / img.width, 1)
        const canvas = document.createElement("canvas")
        canvas.width = Math.round(img.width * ratio)
        canvas.height = Math.round(img.height * ratio)
        canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height)
        canvas.toBlob((blob) => resolve(blob), "image/jpeg", 0.82)
      }
      img.src = e.target.result
    }
    reader.readAsDataURL(file)
  })
}

async function uploadBlob(blob) {
  const path = generatePath()
  const { error } = await supabase.storage.from(BUCKET).upload(path, blob, { contentType: "image/jpeg" })
  if (error) throw error
  return supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl
}

export async function uploadImageFile(file) {
  const blob = await compressFileToBlob(file)
  return uploadBlob(blob)
}

export async function uploadBase64Image(base64) {
  const res = await fetch(base64)
  const blob = await res.blob()
  return uploadBlob(blob)
}

export const isBase64 = (str) => typeof str === "string" && str.startsWith("data:")
