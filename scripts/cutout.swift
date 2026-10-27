import Foundation
import Vision
import AppKit
import CoreImage

// Recorta el sujeto (persona) de una imagen y deja el fondo transparente.
// Uso: swift cutout.swift entrada.jpg salida.png
let args = CommandLine.arguments
guard args.count >= 3 else { print("uso: cutout.swift in out"); exit(1) }
let inURL = URL(fileURLWithPath: args[1])
let outURL = URL(fileURLWithPath: args[2])

guard let nsImg = NSImage(contentsOf: inURL),
      let cg = nsImg.cgImage(forProposedRect: nil, context: nil, hints: nil) else {
    print("ERROR: no se pudo leer la imagen"); exit(2)
}

let request = VNGenerateForegroundInstanceMaskRequest()
let handler = VNImageRequestHandler(cgImage: cg, options: [:])
do { try handler.perform([request]) } catch { print("ERROR vision: \(error)"); exit(3) }

guard let result = request.results?.first else { print("ERROR: sin sujeto detectado"); exit(4) }

let maskBuffer: CVPixelBuffer
do { maskBuffer = try result.generateScaledMaskForImage(forInstances: result.allInstances, from: handler) }
catch { print("ERROR mask: \(error)"); exit(5) }

let ciImg = CIImage(cgImage: cg)
let ciMask = CIImage(cvPixelBuffer: maskBuffer)
let clear = CIImage(color: .clear).cropped(to: ciImg.extent)

let f = CIFilter(name: "CIBlendWithMask")!
f.setValue(ciImg, forKey: kCIInputImageKey)
f.setValue(clear, forKey: kCIInputBackgroundImageKey)
f.setValue(ciMask, forKey: kCIInputMaskImageKey)
guard let out = f.outputImage else { print("ERROR blend"); exit(6) }

let ctx = CIContext()
guard let cgOut = ctx.createCGImage(out, from: ciImg.extent) else { print("ERROR cgImage"); exit(7) }
let rep = NSBitmapImageRep(cgImage: cgOut)
rep.size = NSSize(width: cgOut.width, height: cgOut.height)
guard let data = rep.representation(using: .png, properties: [:]) else { print("ERROR png"); exit(8) }
do { try data.write(to: outURL); print("OK \(outURL.path) \(cgOut.width)x\(cgOut.height) \(data.count) bytes") }
catch { print("ERROR write: \(error)"); exit(9) }
