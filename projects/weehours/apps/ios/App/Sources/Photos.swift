import ImageIO
import LogCore
import Photos
import PhotosUI
import SwiftUI
import UniformTypeIdentifiers

// Photos on entries (docs/decisions.md, 2026-10-23): resized to 2048 px JPEG, kept in the App Group
// container and uploaded to the household's folder in the storage bucket (`<household>/photos/<id>.jpg`)
// so every household phone sees them. The log carries a `photo` entry per picture (LogCore
// `EntryPhoto`), written at once, offline-first; the file uploads on the next sync and other phones
// download it when they first show it. Adding needs the subscription (or trial); looking never does.
// Pictures taken with the in-app camera are also saved, full size, to the iPhone's Photos library.

enum PhotoFiles {
    static let maxPixels = 2048
    static let quality = 0.8

    static var directory: URL {
        let dir = SharedStore.container.appendingPathComponent("Photos", isDirectory: true)
        try? FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)
        return dir
    }

    static func url(_ id: UUID) -> URL { directory.appendingPathComponent("\(id.uuidString.lowercased()).jpg") }

    /// Photo ids written here and not uploaded yet (and storage keys to delete), kept across launches.
    static var pendingUploads: [UUID] {
        get { (SharedStore.defaults.stringArray(forKey: "photoUploads") ?? []).compactMap(UUID.init(uuidString:)) }
        set { SharedStore.defaults.set(newValue.map(\.uuidString), forKey: "photoUploads") }
    }
    static var pendingDeletes: [String] {
        get { SharedStore.defaults.stringArray(forKey: "photoDeletes") ?? [] }
        set { SharedStore.defaults.set(newValue, forKey: "photoDeletes") }
    }

    struct Prepared { let jpeg: Data; let width: Int; let height: Int; let takenAt: Date? }

    /// Any image data (HEIC, JPEG, PNG…) → an upright JPEG no larger than 2048 px, with when it was taken.
    static func prepare(_ data: Data) -> Prepared? {
        guard let src = CGImageSourceCreateWithData(data as CFData, nil) else { return nil }
        let opts: [CFString: Any] = [
            kCGImageSourceCreateThumbnailFromImageAlways: true,
            kCGImageSourceCreateThumbnailWithTransform: true,
            kCGImageSourceThumbnailMaxPixelSize: maxPixels,
        ]
        guard let image = CGImageSourceCreateThumbnailAtIndex(src, 0, opts as CFDictionary) else { return nil }
        let out = NSMutableData()
        guard let dest = CGImageDestinationCreateWithData(out, UTType.jpeg.identifier as CFString, 1, nil) else { return nil }
        CGImageDestinationAddImage(dest, image, [kCGImageDestinationLossyCompressionQuality: quality] as CFDictionary)
        guard CGImageDestinationFinalize(dest) else { return nil }
        return Prepared(jpeg: out as Data, width: image.width, height: image.height, takenAt: takenAt(src))
    }

    private static func takenAt(_ src: CGImageSource) -> Date? {
        let props = CGImageSourceCopyPropertiesAtIndex(src, 0, nil) as? [CFString: Any]
        guard let exif = props?[kCGImagePropertyExifDictionary] as? [CFString: Any],
              let s = exif[kCGImagePropertyExifDateTimeOriginal] as? String else { return nil }
        let f = DateFormatter()
        f.locale = Locale(identifier: "en_US_POSIX")
        f.dateFormat = "yyyy:MM:dd HH:mm:ss"
        return f.date(from: s)
    }

    /// A generated test picture (the `-demoPhotos` launch argument).
    static func sample(_ i: Int) -> Data? {
        let hues: [CGFloat] = [0.08, 0.55, 0.75, 0.33, 0.95]
        let size = CGSize(width: 1600, height: 1200)
        return UIGraphicsImageRenderer(size: size).image { ctx in
            let h = hues[i % hues.count]
            let colors = [UIColor(hue: h, saturation: 0.5, brightness: 0.95, alpha: 1).cgColor, UIColor(hue: h, saturation: 0.8, brightness: 0.55, alpha: 1).cgColor]
            let g = CGGradient(colorsSpace: nil, colors: colors as CFArray, locations: [0, 1])!
            ctx.cgContext.drawLinearGradient(g, start: .zero, end: CGPoint(x: size.width, y: size.height), options: [])
            let text = "Moment \(i + 1)" as NSString
            text.draw(at: CGPoint(x: 80, y: 520), withAttributes: [.font: UIFont.systemFont(ofSize: 140, weight: .bold), .foregroundColor: UIColor.white])
        }.jpegData(compressionQuality: 0.9)
    }

    private static let thumbs = NSCache<NSString, UIImage>()

    /// A small upright image from a stored file (downsampled, never the whole picture in memory).
    static func thumbnail(_ id: UUID, pixels: Int) -> UIImage? {
        let key = "\(id)-\(pixels)" as NSString
        if let hit = thumbs.object(forKey: key) { return hit }
        guard let src = CGImageSourceCreateWithURL(url(id) as CFURL, nil) else { return nil }
        let opts: [CFString: Any] = [kCGImageSourceCreateThumbnailFromImageAlways: true, kCGImageSourceCreateThumbnailWithTransform: true,
                                     kCGImageSourceThumbnailMaxPixelSize: pixels]
        guard let cg = CGImageSourceCreateThumbnailAtIndex(src, 0, opts as CFDictionary) else { return nil }
        let image = UIImage(cgImage: cg)
        thumbs.setObject(image, forKey: key)
        return image
    }
}

extension AppModel {
    /// Prepares, stores and attaches pictures to an entry; uploads follow on the next sync.
    func attachPhotos(_ items: [Data], to entry: LogEvent) {
        guard let service, allows(.photos) else { return }
        Task {
            var added = 0
            for data in items {
                guard let p = await Task.detached(priority: .userInitiated, operation: { PhotoFiles.prepare(data) }).value else { continue }
                let id = UUID()
                do {
                    try p.jpeg.write(to: PhotoFiles.url(id), options: .atomic)
                    try await service.attachPhoto(id: id, to: entry, width: p.width, height: p.height, takenAt: p.takenAt)
                    PhotoFiles.pendingUploads.append(id)
                    added += 1
                } catch {
                    try? FileManager.default.removeItem(at: PhotoFiles.url(id))
                    self.error = error.localizedDescription
                }
            }
            guard added > 0 else { return }
            toast = Toast(text: added == 1 ? "Photo added" : "\(added) photos added", undo: nil)
            await refresh()
            Task { await syncNow(); announceChange() }
        }
    }

    /// Takes a photo off its entry: an undo in the log, the file gone here and from storage.
    func removePhoto(_ photo: EntryPhoto) {
        guard let service else { return }
        Task {
            do {
                try await service.undo(photo.id)
                try? FileManager.default.removeItem(at: PhotoFiles.url(photo.id))
                PhotoFiles.pendingUploads.removeAll { $0 == photo.id }
                if !localOnly { PhotoFiles.pendingDeletes.append(photo.storageKey) }
                await refresh()
                Task { await syncNow(); announceChange() }
            } catch { self.error = error.localizedDescription }
        }
    }

    /// Runs with every sync: uploads waiting photos and deletes removed ones. Offline is fine: they wait.
    func syncPhotos() async {
        guard !localOnly else { return }
        for key in PhotoFiles.pendingDeletes {
            do {
                try await backend.deletePhoto(key: key)
                PhotoFiles.pendingDeletes.removeAll { $0 == key }
            } catch BackendError.http(let code, _) where code == 400 || code == 404 {
                PhotoFiles.pendingDeletes.removeAll { $0 == key }   // already gone
            } catch { break }
        }
        let photos = Dictionary(log.all.compactMap(EntryPhoto.init).map { ($0.id, $0) }, uniquingKeysWith: { a, _ in a })
        for id in PhotoFiles.pendingUploads {
            guard let photo = photos[id], log.status[id] == .active else {
                if log.status[id] == .undone { PhotoFiles.pendingUploads.removeAll { $0 == id } }
                continue
            }
            guard let data = try? Data(contentsOf: PhotoFiles.url(id)) else { PhotoFiles.pendingUploads.removeAll { $0 == id }; continue }
            do {
                try await backend.uploadPhoto(key: photo.storageKey, data: data)
                PhotoFiles.pendingUploads.removeAll { $0 == id }
            } catch { break }   // offline: try again next sync
        }
    }

    /// The photo's file here, downloading it first when another phone added it.
    func photoFile(_ photo: EntryPhoto) async -> URL? {
        let url = PhotoFiles.url(photo.id)
        if FileManager.default.fileExists(atPath: url.path) { return url }
        guard !localOnly, let data = try? await backend.downloadPhoto(key: photo.storageKey) else { return nil }
        try? data.write(to: url, options: .atomic)
        return url
    }

    /// Whether a photo was added here and is still on its way up.
    func photoUploading(_ photo: EntryPhoto) -> Bool { PhotoFiles.pendingUploads.contains(photo.id) }
}

// MARK: - views

/// One photo, square-cropped, loading (or downloading) its file as it appears.
struct PhotoThumb: View {
    @EnvironmentObject var model: AppModel
    let photo: EntryPhoto
    var size: CGFloat = 56
    @State private var image: UIImage?
    @State private var failed = false

    var body: some View {
        ZStack {
            Rectangle().fill(Color(.tertiarySystemFill))
            if let image {
                Image(uiImage: image).resizable().scaledToFill()
            } else if failed {
                Image(systemName: "icloud.slash").foregroundStyle(.secondary)
            } else {
                ProgressView().controlSize(.small)
            }
        }
        .frame(width: size, height: size)
        .clipShape(RoundedRectangle(cornerRadius: 8))
        .task(id: photo.id) {
            let pixels = Int(size * 3)
            if let hit = PhotoFiles.thumbnail(photo.id, pixels: pixels) { image = hit; return }
            if await model.photoFile(photo) != nil { image = PhotoFiles.thumbnail(photo.id, pixels: pixels) }
            failed = image == nil
        }
        .accessibilityLabel("Photo")
    }
}

/// A row's photos: up to four, the last showing how many more there are.
struct PhotoStrip: View {
    let photos: [EntryPhoto]
    let onOpen: (Int) -> Void
    private let shown = 4

    var body: some View {
        HStack(spacing: 6) {
            ForEach(Array(photos.prefix(shown).enumerated()), id: \.element.id) { i, p in
                Button { onOpen(i) } label: {
                    PhotoThumb(photo: p)
                        .overlay {
                            if i == shown - 1, photos.count > shown {
                                RoundedRectangle(cornerRadius: 8).fill(.black.opacity(0.45))
                                Text("+\(photos.count - shown + 1)").font(.headline).foregroundStyle(.white)
                            }
                        }
                }
                .buttonStyle(.plain)
            }
        }
        .padding(.top, 4)
    }
}

/// Which photos the viewer pages through, and where it starts.
struct PhotoViewing: Identifiable {
    let id = UUID()
    let photos: [EntryPhoto]
    let start: Int
}

/// Full-screen photos: swipe between them, pinch to zoom, share or remove.
struct PhotoViewer: View {
    @EnvironmentObject var model: AppModel
    @Environment(\.dismiss) private var dismiss
    let photos: [EntryPhoto]
    @State private var index: Int
    @State private var confirmRemove = false
    @State private var file: URL?

    init(_ viewing: PhotoViewing) {
        photos = viewing.photos
        _index = State(initialValue: min(viewing.start, max(0, viewing.photos.count - 1)))
    }

    private var current: EntryPhoto? { photos.indices.contains(index) ? photos[index] : nil }

    var body: some View {
        NavigationStack {
            TabView(selection: $index) {
                ForEach(Array(photos.enumerated()), id: \.element.id) { i, p in
                    ZoomablePhoto(photo: p).tag(i)
                }
            }
            .tabViewStyle(.page(indexDisplayMode: photos.count > 1 ? .automatic : .never))
            .background(Color.black.ignoresSafeArea())
            .navigationBarTitleDisplayMode(.inline)
            .toolbarBackground(.visible, for: .navigationBar, .bottomBar)
            .toolbar {
                ToolbarItem(placement: .topBarLeading) { Button("Done") { dismiss() } }
                ToolbarItem(placement: .principal) {
                    if let p = current {
                        VStack(spacing: 0) {
                            Text(caption(p)).font(.subheadline.weight(.semibold)).lineLimit(1)
                            Text(p.takenAt.formatted(date: .abbreviated, time: .shortened)).font(.caption2).foregroundStyle(.secondary)
                        }
                    }
                }
                ToolbarItemGroup(placement: .bottomBar) {
                    if let file { ShareLink(item: file) { Image(systemName: "square.and.arrow.up") } }
                    Spacer()
                    if let p = current, model.photoUploading(p) {
                        Label("Uploading", systemImage: "icloud.and.arrow.up").font(.caption).foregroundStyle(.secondary)
                        Spacer()
                    }
                    Button(role: .destructive) { confirmRemove = true } label: { Image(systemName: "trash") }
                        .accessibilityLabel("Remove photo")
                }
            }
            .confirmationDialog("Remove this photo from the entry?", isPresented: $confirmRemove, titleVisibility: .visible) {
                Button("Remove photo", role: .destructive) {
                    guard let p = current else { return }
                    model.removePhoto(p)
                    if photos.count == 1 { dismiss() } else if index == photos.count - 1 { index -= 1 }
                }
            } message: {
                Text("It's removed for everyone in the household. A copy you saved to Photos stays there.")
            }
            .task(id: index) { file = nil; if let p = current { file = await model.photoFile(p) } }
        }
    }

    private func caption(_ p: EntryPhoto) -> String {
        guard let e = model.log.entry(for: p) else { return "Photo" }
        return e.type == SystemType.note ? "Note" : VoiceInterpreter.label(type: e.type, fields: e.fields)
    }
}

private struct ZoomablePhoto: View {
    @EnvironmentObject var model: AppModel
    let photo: EntryPhoto
    @State private var image: UIImage?
    @State private var scale: CGFloat = 1
    @State private var base: CGFloat = 1

    var body: some View {
        ZStack {
            if let image {
                Image(uiImage: image).resizable().scaledToFit()
                    .scaleEffect(scale)
                    .gesture(MagnifyGesture()
                        .onChanged { scale = max(1, base * $0.magnification) }
                        .onEnded { _ in base = scale })
                    .onTapGesture(count: 2) { withAnimation(.snappy) { scale = scale > 1 ? 1 : 2.5; base = scale } }
            } else {
                ProgressView().tint(.white)
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .task(id: photo.id) {
            if let url = await model.photoFile(photo), let data = try? Data(contentsOf: url) { image = UIImage(data: data) }
        }
    }
}

/// Camera and photo-library buttons that attach what they bring back to `entry`. Without the
/// subscription they open the paywall instead. Camera shots are also saved to the Photos library.
struct AddPhotoButtons: View {
    enum Style { case buttons, icons, menu }
    @EnvironmentObject var model: AppModel
    let entry: LogEvent
    var style: Style = .buttons
    @State private var picked: [PhotosPickerItem] = []
    @State private var camera = false

    private var hasCamera: Bool { UIImagePickerController.isSourceTypeAvailable(.camera) }

    var body: some View {
        Group {
            if !model.allows(.photos) {
                Button { model.screen = "paywall" } label: {
                    Label("Add photos", systemImage: "lock.fill")
                }
            } else {
                switch style {
                case .buttons:
                    HStack(spacing: 10) {
                        if hasCamera { cameraButton.buttonStyle(.bordered) }
                        library.buttonStyle(.bordered)
                    }
                case .icons:
                    HStack(spacing: 10) {
                        if hasCamera { cameraButton.labelStyle(.iconOnly).buttonStyle(.borderedProminent) }
                        library.labelStyle(.iconOnly).buttonStyle(.bordered)
                    }
                case .menu:
                    Menu {
                        if hasCamera { cameraButton }
                        library
                    } label: { Image(systemName: "camera.fill") }
                    .accessibilityLabel("Add photos")
                }
            }
        }
        .onChange(of: picked) { _, items in
            guard !items.isEmpty else { return }
            picked = []
            Task {
                var datas: [Data] = []
                for item in items { if let d = try? await item.loadTransferable(type: Data.self) { datas.append(d) } }
                model.attachPhotos(datas, to: entry)
            }
        }
        .fullScreenCover(isPresented: $camera) {
            CameraPicker { data in
                if let data { model.attachPhotos([data], to: entry); PhotoLibrarySaver.save(data) }
            }
            .ignoresSafeArea()
        }
    }

    private var cameraButton: some View {
        Button { camera = true } label: { Label("Take photo", systemImage: "camera.fill") }
            .accessibilityIdentifier("takePhoto")
    }

    private var library: some View {
        PhotosPicker(selection: $picked, maxSelectionCount: nil, selectionBehavior: .ordered, matching: .images) {
            Label("Choose photos", systemImage: "photo.on.rectangle.angled")
        }
        .accessibilityIdentifier("choosePhotos")
    }
}

/// Saves a camera shot, full size, to the iPhone's Photos library (add-only access), so the
/// picture is in Photos like any other, besides the resized copy on the entry.
enum PhotoLibrarySaver {
    static func save(_ data: Data) {
        PHPhotoLibrary.requestAuthorization(for: .addOnly) { status in
            guard status == .authorized || status == .limited else { return }
            PHPhotoLibrary.shared().performChanges {
                PHAssetCreationRequest.forAsset().addResource(with: .photo, data: data, options: nil)
            }
        }
    }
}

/// The system camera. Hands back the shot's data (with its metadata) or nil when cancelled.
struct CameraPicker: UIViewControllerRepresentable {
    let done: (Data?) -> Void
    @Environment(\.dismiss) private var dismiss

    func makeUIViewController(context: Context) -> UIImagePickerController {
        let c = UIImagePickerController()
        c.sourceType = .camera
        c.delegate = context.coordinator
        return c
    }

    func updateUIViewController(_ controller: UIImagePickerController, context: Context) {}

    func makeCoordinator() -> Coordinator { Coordinator(self) }

    final class Coordinator: NSObject, UIImagePickerControllerDelegate, UINavigationControllerDelegate {
        let parent: CameraPicker
        init(_ parent: CameraPicker) { self.parent = parent }

        func imagePickerController(_ picker: UIImagePickerController, didFinishPickingMediaWithInfo info: [UIImagePickerController.InfoKey: Any]) {
            let image = info[.originalImage] as? UIImage
            parent.done(image.flatMap { Self.jpeg($0, metadata: info[.mediaMetadata] as? [String: Any]) })
            parent.dismiss()
        }

        func imagePickerControllerDidCancel(_ picker: UIImagePickerController) {
            parent.done(nil)
            parent.dismiss()
        }

        /// Full-size JPEG keeping the camera's metadata (orientation, when it was taken).
        static func jpeg(_ image: UIImage, metadata: [String: Any]?) -> Data? {
            guard let cg = image.cgImage else { return image.jpegData(compressionQuality: 0.9) }
            let out = NSMutableData()
            guard let dest = CGImageDestinationCreateWithData(out, UTType.jpeg.identifier as CFString, 1, nil) else { return nil }
            var props = metadata ?? [:]
            props[kCGImageDestinationLossyCompressionQuality as String] = 0.9
            props[kCGImagePropertyOrientation as String] = Self.exifOrientation(image.imageOrientation)
            CGImageDestinationAddImage(dest, cg, props as CFDictionary)
            return CGImageDestinationFinalize(dest) ? out as Data : image.jpegData(compressionQuality: 0.9)
        }

        static func exifOrientation(_ o: UIImage.Orientation) -> UInt32 {
            switch o {
            case .up: return 1
            case .upMirrored: return 2
            case .down: return 3
            case .downMirrored: return 4
            case .leftMirrored: return 5
            case .right: return 6
            case .rightMirrored: return 7
            case .left: return 8
            @unknown default: return 1
            }
        }
    }
}

/// Every photo in the log, by day, newest first: the memories view. Tap one to page through all.
struct PhotoGalleryView: View {
    @EnvironmentObject var model: AppModel
    /// Only this child's photos (nil: everyone's).
    var child: UUID?
    @State private var viewing: PhotoViewing?
    private let columns = [GridItem(.adaptive(minimum: 104), spacing: 4)]

    var body: some View {
        let photos = model.log.allPhotos.filter { child == nil || $0.babyId == child }
        let days = Dictionary(grouping: photos) { Calendar.current.startOfDay(for: $0.takenAt) }
        ScrollView {
            if photos.isEmpty {
                ContentUnavailableView("No photos yet", systemImage: "photo.on.rectangle.angled",
                                       description: Text("Open an entry and add photos, or tap the camera on Now while a feed, nap or activity is going."))
                    .padding(.top, 60)
            }
            LazyVStack(alignment: .leading, spacing: 18) {
                ForEach(days.keys.sorted(by: >), id: \.self) { day in
                    VStack(alignment: .leading, spacing: 6) {
                        Text(day.formatted(date: .complete, time: .omitted)).font(.subheadline.weight(.semibold)).foregroundStyle(.secondary)
                        LazyVGrid(columns: columns, spacing: 4) {
                            ForEach(days[day]!) { p in
                                Button { viewing = PhotoViewing(photos: photos, start: photos.firstIndex(of: p) ?? 0) } label: {
                                    GeometryReader { geo in PhotoThumb(photo: p, size: geo.size.width) }
                                        .aspectRatio(1, contentMode: .fit)
                                }
                                .buttonStyle(.plain)
                            }
                        }
                    }
                }
            }
            .padding()
        }
        .navigationTitle("Photos")
        .fullScreenCover(item: $viewing) { PhotoViewer($0) }
    }
}

/// On Now while something is going (a feed, a nap, tummy time, play…): camera and library buttons
/// that attach straight to it, so a moment is caught while it happens.
struct OngoingPhotosCard: View {
    @EnvironmentObject var model: AppModel
    let now: Date
    @State private var viewing: PhotoViewing?

    struct Ongoing: Identifiable {
        let entry: LogEvent
        let title: String
        let since: Date
        let photos: [EntryPhoto]
        var id: UUID { entry.id }
    }

    var ongoing: [Ongoing] {
        let log = model.log
        let shown = Set(model.shown.map(\.id))
        let several = model.shown.count > 1
        var out: [Ongoing] = []
        let byId = Dictionary(log.all.map { ($0.id, $0) }, uniquingKeysWith: { a, _ in a })
        for s in log.sessions where s.isOpen && shown.contains(s.babyId ?? UUID()) {
            guard let id = s.startEvent, let start = byId[id] else { continue }
            let kind = s.kind == .bottle ? "Bottle" : s.kind == .breast ? "Nursing" : "Sleep"
            out.append(Ongoing(entry: start, title: kind + (several ? " · \(model.household.babyName(start.babyId))" : ""),
                               since: s.start ?? start.occurredAt, photos: log.photos(for: start)))
        }
        for e in log.effective where e.fields["ongoing"] == .bool(true) && shown.contains(e.babyId) {
            let name = EventRegistry.shared.type(e.type)?.label ?? VoiceInterpreter.label(type: e.type, fields: [:])
            out.append(Ongoing(entry: e, title: name + (several ? " · \(model.household.babyName(e.babyId))" : ""),
                               since: e.occurredAt, photos: log.photos(for: e)))
        }
        return out.sorted { $0.since > $1.since }
    }

    var body: some View {
        let items = ongoing
        if !items.isEmpty {
            VStack(alignment: .leading, spacing: 12) {
                ForEach(items) { o in
                    HStack(alignment: .center, spacing: 12) {
                        Image(systemName: Theme.icon(for: o.entry.type)).font(.title3).foregroundStyle(Theme.color(for: o.entry.type)).frame(width: 28)
                        VStack(alignment: .leading, spacing: 2) {
                            Text(o.title).font(.subheadline.weight(.semibold))
                            Text("\(StatusSnapshot.duration(now.timeIntervalSince(o.since))) · \(o.photos.isEmpty ? "catch the moment" : "\(o.photos.count) photo\(o.photos.count == 1 ? "" : "s")")")
                                .font(.caption).foregroundStyle(.secondary)
                        }
                        Spacer(minLength: 4)
                        if let last = o.photos.last {
                            Button { viewing = PhotoViewing(photos: o.photos, start: o.photos.count - 1) } label: { PhotoThumb(photo: last, size: 40) }
                                .buttonStyle(.plain)
                        }
                        AddPhotoButtons(entry: o.entry, style: .icons)
                    }
                }
            }
            .padding()
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(Theme.card, in: RoundedRectangle(cornerRadius: 18))
            .fullScreenCover(item: $viewing) { PhotoViewer($0) }
            .accessibilityIdentifier("ongoingPhotos")
        }
    }
}

/// An entry's photos in its editor: the pictures, and buttons to add more.
struct EntryPhotosSection: View {
    @EnvironmentObject var model: AppModel
    let entry: LogEvent
    @State private var viewing: PhotoViewing?

    var body: some View {
        let photos = model.log.photos(for: entry)
        Section {
            if !photos.isEmpty {
                ScrollView(.horizontal, showsIndicators: false) {
                    HStack(spacing: 8) {
                        ForEach(Array(photos.enumerated()), id: \.element.id) { i, p in
                            Button { viewing = PhotoViewing(photos: photos, start: i) } label: { PhotoThumb(photo: p, size: 76) }
                                .buttonStyle(.plain)
                        }
                    }
                }
            }
            AddPhotoButtons(entry: entry)
        } header: {
            Text("Photos")
        } footer: {
            Text("Shared with your household. Pictures you take here are also saved to your Photos library.")
        }
        .fullScreenCover(item: $viewing) { PhotoViewer($0) }
    }
}

/// "Add photos to Tummy time": opened from the toast right after logging.
struct AddPhotosSheet: View {
    @EnvironmentObject var model: AppModel
    @Environment(\.dismiss) private var dismiss
    let entry: LogEvent

    var body: some View {
        let photos = model.log.photos(for: entry)
        VStack(alignment: .leading, spacing: 16) {
            HStack {
                Image(systemName: Theme.icon(for: entry.type)).foregroundStyle(Theme.color(for: entry.type))
                Text("Add photos to \(VoiceInterpreter.label(type: entry.type, fields: entry.fields))").font(.headline).lineLimit(2)
                Spacer()
                Button("Done") { dismiss() }
            }
            if !photos.isEmpty {
                ScrollView(.horizontal, showsIndicators: false) {
                    HStack(spacing: 8) { ForEach(photos) { PhotoThumb(photo: $0, size: 64) } }
                }
            }
            AddPhotoButtons(entry: entry)
        }
        .padding()
        .presentationDetents([.height(photos.isEmpty ? 150 : 230)])
    }
}
