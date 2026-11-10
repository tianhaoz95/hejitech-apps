import CryptoKit
import Foundation

public enum TOTP {
    /// Decode standard RFC 4648 Base32 string (case-insensitive, strips spaces and hyphens)
    public static func base32Decode(_ string: String) -> Data? {
        let cleaned = string.uppercased().replacingOccurrences(of: " ", with: "").replacingOccurrences(of: "-", with: "")
        guard !cleaned.isEmpty else { return nil }
        
        let alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567"
        var buffer: UInt32 = 0
        var bitsLeft: Int = 0
        var result = Data()

        for char in cleaned {
            if char == "=" { break } // Padding
            guard let index = alphabet.firstIndex(of: char) else { return nil }
            let val = UInt32(alphabet.distance(from: alphabet.startIndex, to: index))
            buffer = (buffer << 5) | val
            bitsLeft += 5

            if bitsLeft >= 8 {
                bitsLeft -= 8
                let byte = UInt8((buffer >> bitsLeft) & 0xFF)
                result.append(byte)
            }
        }

        return result
    }

    /// Generate 6-digit TOTP code for a given timestamp and 30-second step
    public static func generateCode(secret: String, date: Date = Date(), timeStep: TimeInterval = 30) -> String? {
        guard let keyData = base32Decode(secret) else { return nil }
        let counter = UInt64(date.timeIntervalSince1970 / timeStep)
        return generateCode(key: keyData, counter: counter)
    }

    /// RFC 4226 / 6238 HOTP/TOTP computation with HMAC-SHA1
    public static func generateCode(key: Data, counter: UInt64) -> String {
        var bigEndianCounter = counter.bigEndian
        let counterData = Data(bytes: &bigEndianCounter, count: MemoryLayout<UInt64>.size)

        let symmetricKey = SymmetricKey(data: key)
        let mac = HMAC<Insecure.SHA1>.authenticationCode(for: counterData, using: symmetricKey)
        let macData = Data(mac)

        let offset = Int(macData[macData.count - 1] & 0x0F)
        let truncated = macData.subdata(in: offset..<(offset + 4)).withUnsafeBytes { ptr -> UInt32 in
            let raw = ptr.load(as: UInt32.self).bigEndian
            return raw & 0x7FFFFFFF
        }

        let code = truncated % 1_000_000
        return String(format: "%06d", code)
    }

    /// Verify a user-provided 6-digit code with +/- 1 window tolerance
    public static func verify(code: String, secret: String, date: Date = Date(), timeStep: TimeInterval = 30) -> Bool {
        let trimmed = code.replacingOccurrences(of: " ", with: "")
        guard trimmed.count == 6, let keyData = base32Decode(secret) else { return false }
        let currentCounter = UInt64(date.timeIntervalSince1970 / timeStep)

        for delta in [-1, 0, 1] {
            let counter = UInt64(Int64(currentCounter) + Int64(delta))
            if generateCode(key: keyData, counter: counter) == trimmed {
                return true
            }
        }
        return false
    }
}
