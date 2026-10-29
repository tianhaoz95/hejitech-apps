import SwiftUI

/// Settings → About → Acknowledgements: the open-source code and models shipped in the app, with
/// the notices their licenses ask us to include. Add a row when a dependency or bundled model is added.
struct AcknowledgementsView: View {
    struct Notice: Identifiable {
        let name: String
        let use: String
        let copyright: String
        let license: License
        let url: String
        var id: String { name }
    }

    enum License: String {
        case mit = "MIT License"
        case apache2 = "Apache License 2.0"
    }

    static let notices: [Notice] = [
        Notice(name: "llama.cpp", use: "Runs the decision model on your iPhone",
               copyright: "Copyright (c) 2023-2026 The ggml authors", license: .mit, url: "https://github.com/ggml-org/llama.cpp"),
        Notice(name: "WhisperKit (Argmax OSS)", use: "Speech recognition on your iPhone",
               copyright: "Copyright (c) 2024 argmax, inc.", license: .mit, url: "https://github.com/argmaxinc/argmax-oss-swift"),
        Notice(name: "swift-transformers", use: "Tokenizers, as part of WhisperKit (modified by Argmax, Inc.)",
               copyright: "Copyright 2022 Hugging Face SAS.", license: .apache2, url: "https://github.com/huggingface/swift-transformers"),
        Notice(name: "Whisper models", use: "The speech models (base.en and small), converted by Argmax",
               copyright: "Copyright (c) 2022 OpenAI", license: .mit, url: "https://github.com/openai/whisper"),
        Notice(name: "Laya", use: "The base of Wee Hours' decision model, fine-tuned by HEJI Technology",
               copyright: "Copyright Convai Innovations", license: .apache2, url: "https://huggingface.co/convaiinnovations/laya"),
    ]

    static let mitText = """
    Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

    The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

    THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
    """

    static let apacheText = """
    Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file except in compliance with the License. You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0

    Unless required by applicable law or agreed to in writing, software distributed under the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the specific language governing permissions and limitations under the License.
    """

    var body: some View {
        List {
            Section {
                Text("Wee Hours is built on these open-source projects and models. Thank you to their authors.")
                    .font(.subheadline).foregroundStyle(.secondary)
            }
            ForEach(Self.notices) { n in
                Section {
                    VStack(alignment: .leading, spacing: 6) {
                        Text(n.use).font(.subheadline)
                        Text(n.copyright).font(.caption).foregroundStyle(.secondary)
                        Text(n.license.rawValue).font(.caption.bold())
                        if let url = URL(string: n.url) { Link(n.url, destination: url).font(.caption) }
                    }
                } header: { Text(n.name) }
            }
            Section(License.mit.rawValue) { Text(Self.mitText).font(.caption2).foregroundStyle(.secondary) }
            Section(License.apache2.rawValue) {
                Text(Self.apacheText).font(.caption2).foregroundStyle(.secondary)
                Link("Full license text", destination: URL(string: "https://www.apache.org/licenses/LICENSE-2.0")!).font(.caption)
            }
        }
        .navigationTitle("Acknowledgements")
    }
}
