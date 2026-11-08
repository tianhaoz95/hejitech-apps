import SwiftUI

public struct PairingSheet: View {
    @ObservedObject var appModel: AppModel
    @Environment(\.dismiss) private var dismiss

    @State private var code: String = ""
    @State private var isRedeeming: Bool = false
    @State private var errorMessage: String?
    @State private var successNotice: Bool = false

    public init(appModel: AppModel) {
        self.appModel = appModel
    }

    public var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: 24) {
                    // Header icon
                    Image(systemName: appModel.isPaired ? "checkmark.circle.fill" : "qrcode.viewfinder")
                        .font(.system(size: 60))
                        .foregroundStyle(appModel.isPaired ? Color.green : Color.accentColor)
                        .padding(.top, 24)

                    VStack(spacing: 8) {
                        Text(appModel.isPaired ? "Device Paired" : "Pair Your iPhone")
                            .font(.title2.bold())

                        Text(appModel.isPaired
                             ? "This device is paired with your G2 Digest account and receives editions automatically."
                             : "Open the G2 Digest web app, go to Pair, and enter the 6-digit code shown on screen.")
                            .font(.subheadline)
                            .foregroundStyle(.secondary)
                            .multilineTextAlignment(.center)
                            .padding(.horizontal)
                    }

                    if !appModel.isPaired {
                        // 6-digit code input field
                        VStack(spacing: 12) {
                            TextField("123456", text: $code)
                                .font(.system(size: 36, weight: .bold, design: .monospaced))
                                .multilineTextAlignment(.center)
                                .keyboardType(.numberPad)
                                .padding()
                                .background(Color(.secondarySystemBackground))
                                .clipShape(RoundedRectangle(cornerRadius: 16))
                                .padding(.horizontal, 32)
                                .onChange(of: code) { newValue in
                                    let filtered = newValue.filter { $0.isNumber }
                                    if filtered.count > 6 {
                                        code = String(filtered.prefix(6))
                                    } else {
                                        code = filtered
                                    }
                                }

                            if let err = errorMessage {
                                Text(err)
                                    .font(.footnote)
                                    .foregroundStyle(.red)
                                    .multilineTextAlignment(.center)
                                    .padding(.horizontal)
                            }

                            Button {
                                Task {
                                    isRedeeming = true
                                    errorMessage = nil
                                    let ok = await appModel.redeemCode(code)
                                    isRedeeming = false
                                    if ok {
                                        successNotice = true
                                        DispatchQueue.main.asyncAfter(deadline: .now() + 1.2) {
                                            dismiss()
                                        }
                                    } else {
                                        errorMessage = appModel.errorMessage ?? "Invalid code"
                                    }
                                }
                            } label: {
                                HStack {
                                    if isRedeeming {
                                        ProgressView()
                                            .tint(.black)
                                    } else {
                                        Text("Pair Device")
                                            .fontWeight(.bold)
                                    }
                                }
                                .frame(maxWidth: .infinity)
                                .padding()
                                .background(code.count == 6 ? Color.accentColor : Color.secondary.opacity(0.3))
                                .foregroundStyle(code.count == 6 ? Color.black : Color.white)
                                .clipShape(RoundedRectangle(cornerRadius: 14))
                                .padding(.horizontal, 32)
                            }
                            .disabled(code.count != 6 || isRedeeming)
                        }
                    } else {
                        // Unpair button
                        Button(role: .destructive) {
                            appModel.unpair()
                        } label: {
                            Text("Unpair This Device")
                                .fontWeight(.semibold)
                                .padding()
                                .frame(maxWidth: .infinity)
                                .background(Color.red.opacity(0.1))
                                .foregroundStyle(.red)
                                .clipShape(RoundedRectangle(cornerRadius: 14))
                                .padding(.horizontal, 32)
                        }
                    }
                }
                .padding()
            }
            .navigationTitle("Device Pairing")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Close") {
                        dismiss()
                    }
                }
            }
        }
    }
}
