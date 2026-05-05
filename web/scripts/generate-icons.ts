import sharp from 'sharp'
import path from 'path'

const publicDir = path.join(process.cwd(), 'public')

function svg(size: number): Buffer {
  const cx = size / 2
  const r = size * 0.36
  const pentagons = [0, 72, 144, 216, 288].map(deg => {
    const angle = (deg - 90) * (Math.PI / 180)
    const x = cx + r * 0.55 * Math.cos(angle)
    const y = cx + r * 0.55 * Math.sin(angle)
    const pr = r * 0.18
    const points = [0, 72, 144, 216, 288].map(d => {
      const a = (d - 90) * (Math.PI / 180)
      return `${x + pr * Math.cos(a)},${y + pr * Math.sin(a)}`
    }).join(' ')
    return `<polygon points="${points}" fill="#0f172a" />`
  }).join('\n')

  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}">
  <rect width="${size}" height="${size}" rx="${size * 0.22}" fill="#0f172a"/>
  <circle cx="${cx}" cy="${cx}" r="${r}" fill="white"/>
  ${pentagons}
  <circle cx="${cx}" cy="${cx}" r="${r * 0.15}" fill="#0f172a"/>
</svg>`)
}

async function main() {
  for (const size of [192, 512]) {
    await sharp(svg(size)).png().toFile(path.join(publicDir, `icon-${size}.png`))
    console.log(`✓ icon-${size}.png`)
  }
}

main()
