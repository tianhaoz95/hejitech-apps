import HeadwayKit
import SwiftUI

/// The Weather tab: every Caltrain station's weather from the National Weather Service, your
/// commute's stations first, then the whole line north to south. Tap a station for its next hours.
struct WeatherView: View {
    @Environment(AppModel.self) private var model
    /// Shown as a sheet from the Trains tab's weather strip (adds a Done button).
    var asSheet = false
    @Environment(\.dismiss) private var dismiss

    private var commuteIds: [String] {
        var ids: [String] = []
        for id in [model.board?.from.id, model.board?.to.id, model.settings.morning?.from, model.settings.morning?.to] {
            if let id, !ids.contains(id) { ids.append(id) }
        }
        return ids
    }

    var body: some View {
        NavigationStack {
            List {
                if let w = model.weather {
                    if !w.alerts.isEmpty {
                        Section("Weather alerts") {
                            ForEach(w.alerts) { a in WeatherAlertRow(alert: a, stations: a.stations.map(model.stationName)) }
                        }
                    }
                    let mine = commuteIds.compactMap { id in w.stations.first { $0.id == id } }
                    if !mine.isEmpty {
                        Section("Your stations") {
                            ForEach(mine) { s in
                                NavigationLink(value: s.id) { StationWeatherRow(station: s) }
                            }
                        }
                    }
                    Section {
                        ForEach(w.stations) { s in
                            NavigationLink(value: s.id) { StationWeatherRow(station: s) }
                        }
                    } header: {
                        Text("All stations, north to south")
                    } footer: {
                        WeatherSourceFooter(report: w)
                    }
                } else if model.weatherError != nil {
                    ContentUnavailableView {
                        Label("No weather right now", systemImage: "cloud.slash")
                    } description: {
                        Text("Couldn't load the forecast. Pull to try again.")
                    }
                } else {
                    HStack { Spacer(); ProgressView(); Spacer() }
                }
            }
            .navigationTitle("Station weather")
            .navigationDestination(for: String.self) { id in
                if let s = model.weather?.stations.first(where: { $0.id == id }) {
                    StationWeatherDetail(station: s, alerts: model.weather?.alerts.filter { s.alertIds.contains($0.id) } ?? [], updatedAt: model.weather?.updatedAt)
                }
            }
            .refreshable { await model.loadWeather(force: true) }
            .task { await model.loadWeather() }
            .toolbar {
                if asSheet {
                    ToolbarItem(placement: .confirmationAction) { Button("Done") { dismiss() } }
                }
            }
        }
    }
}

struct StationWeatherRow: View {
    let station: StationWeather

    var body: some View {
        HStack(spacing: 12) {
            if let h = station.now {
                WeatherIcon(hour: h).font(.title2).frame(width: 36)
            } else {
                Image(systemName: "questionmark.circle").font(.title2).foregroundStyle(.tertiary).frame(width: 36)
            }
            VStack(alignment: .leading, spacing: 2) {
                Text(station.name).font(.body.weight(.medium))
                Text(subtitle).font(.caption).foregroundStyle(subtitleColor).lineLimit(1)
            }
            Spacer()
            if let h = station.now {
                VStack(alignment: .trailing, spacing: 2) {
                    Text("\(h.tempF)°").font(.title3.weight(.semibold).monospacedDigit())
                    if let hi = station.highF, let lo = station.lowF, hi != lo {
                        Text("\(lo)° – \(hi)°").font(.caption.monospacedDigit()).foregroundStyle(.secondary)
                    }
                }
            }
        }
        .accessibilityElement(children: .combine)
    }

    private var subtitle: String {
        guard let h = station.now else { return "No forecast yet" }
        if !station.alertIds.isEmpty { return "Weather alert · \(h.words)" }
        if h.cond.isWet { return "\(h.words) · \(h.pop)% chance" }
        if let r = station.rainAt { return "\(h.words) · rain from \(Clock.hour(r))" }
        return h.windMph >= 20 ? "\(h.words) · wind \(h.windMph) mph" : h.words
    }

    private var subtitleColor: Color {
        if !station.alertIds.isEmpty { return .orange }
        if station.now?.cond.isWet == true || station.rainAt != nil { return .blue }
        return .secondary
    }
}

struct StationWeatherDetail: View {
    let station: StationWeather
    let alerts: [WeatherAlert]
    let updatedAt: Double?

    var body: some View {
        List {
            if let h = station.now {
                Section {
                    HStack(spacing: 16) {
                        WeatherIcon(hour: h).font(.system(size: 48))
                        VStack(alignment: .leading, spacing: 4) {
                            Text("\(h.tempF)°").font(.system(size: 44, weight: .semibold).monospacedDigit())
                            Text(h.text.isEmpty ? h.words : h.text).font(.headline)
                            Text(detailLine(h)).font(.subheadline).foregroundStyle(.secondary)
                        }
                    }
                    .padding(.vertical, 6)
                    .accessibilityElement(children: .combine)
                }
            }
            if !alerts.isEmpty {
                Section("Weather alerts") {
                    ForEach(alerts) { a in WeatherAlertRow(alert: a, stations: []) }
                }
            }
            if !station.hours.isEmpty {
                Section("Next hours") {
                    ScrollView(.horizontal, showsIndicators: false) {
                        HStack(spacing: 18) {
                            ForEach(station.hours, id: \.t) { h in
                                VStack(spacing: 6) {
                                    Text(Clock.hour(h.t)).font(.caption.weight(.medium)).foregroundStyle(.secondary)
                                    WeatherIcon(hour: h).font(.title3).frame(height: 26)
                                    Text("\(h.tempF)°").font(.subheadline.weight(.semibold).monospacedDigit())
                                    Text(h.pop >= 10 ? "\(h.pop)%" : " ").font(.caption2.monospacedDigit()).foregroundStyle(.blue)
                                }
                                .accessibilityElement(children: .combine)
                                .accessibilityLabel("\(Clock.hour(h.t)): \(h.tempF) degrees, \(h.words)\(h.pop >= 10 ? ", \(h.pop) percent chance of rain" : "")")
                            }
                        }
                        .padding(.vertical, 4)
                    }
                }
            }
            Section {
                EmptyView()
            } footer: {
                Text("Forecast from the National Weather Service\(updatedAt.map { ", updated \(Clock.time($0))" } ?? ""). Temperatures in °F.")
            }
        }
        .navigationTitle(station.name)
        .navigationBarTitleDisplayMode(.inline)
    }

    private func detailLine(_ h: WeatherHour) -> String {
        var parts: [String] = []
        if let hi = station.highF, let lo = station.lowF { parts.append("\(lo)° – \(hi)° next 12 h") }
        parts.append("\(h.pop)% rain")
        parts.append("wind \(h.windMph) mph")
        return parts.joined(separator: " · ")
    }
}

struct WeatherAlertRow: View {
    let alert: WeatherAlert
    let stations: [String]

    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            Label(alert.event, systemImage: "exclamationmark.triangle.fill")
                .font(.subheadline.weight(.semibold))
                .foregroundStyle(alert.severity == "Extreme" || alert.severity == "Severe" ? .red : .orange)
            if alert.headline != alert.event { Text(alert.headline).font(.footnote) }
            if !stations.isEmpty {
                Text(stations.count > 4 ? "\(stations.prefix(3).joined(separator: ", ")) and \(stations.count - 3) more" : stations.joined(separator: ", "))
                    .font(.caption).foregroundStyle(.secondary)
            }
        }
    }
}

struct WeatherSourceFooter: View {
    let report: WeatherReport
    var body: some View {
        Text("Forecast from the National Weather Service\(report.updatedAt.map { ", updated \(Clock.time($0))" } ?? ""), refreshed every two hours. Temperatures in °F.")
    }
}

/// The condition's symbol in colors that read on light and dark backgrounds (multicolor clouds are white).
struct WeatherIcon: View {
    let hour: WeatherHour
    private let cloud = Color.gray
    var body: some View {
        Image(systemName: hour.symbol)
            .symbolRenderingMode(.palette)
            .foregroundStyle(colors.0, colors.1, colors.2)
            .accessibilityLabel(hour.words)
    }

    private var colors: (Color, Color, Color) {
        switch hour.cond {
        case .clear, .mostlyClear: hour.day ? (.yellow, .yellow, .yellow) : (.indigo, .indigo, .indigo)
        case .partlyCloudy: (cloud, hour.day ? .yellow : .indigo, .yellow)
        case .haze: (hour.day ? .yellow : .indigo, cloud, cloud)
        case .drizzle, .rain, .showers: (cloud, .blue, .blue)
        case .thunder: (cloud, .yellow, .blue)
        case .snow: (cloud, .cyan, .cyan)
        case .cloudy, .fog, .smoke, .wind: (cloud, cloud, cloud)
        }
    }
}

/// On the Trains tab, under the board's header: the weather where you leave now and where you get
/// off when the next train gets there, with a nudge to bring an umbrella. Tap for every station.
struct BoardWeatherStrip: View {
    let board: Board
    let weather: BoardWeather
    var onTap: () -> Void

    var body: some View {
        Button(action: onTap) {
            VStack(alignment: .leading, spacing: 8) {
                HStack(alignment: .top, spacing: 10) {
                    end(board.from.name, caption: "Now", hour: weather.from)
                    Image(systemName: "arrow.right").font(.caption.weight(.bold)).foregroundStyle(.tertiary).padding(.top, 18)
                    end(board.to.name, caption: weather.toAt.map { "At \(Clock.time($0))" } ?? "Now", hour: weather.to)
                    Spacer(minLength: 0)
                    Image(systemName: "chevron.right").font(.caption.weight(.semibold)).foregroundStyle(.tertiary).padding(.top, 18)
                }
                if let note {
                    Label(note.text, systemImage: note.symbol)
                        .font(.footnote.weight(.medium))
                        .foregroundStyle(note.color)
                }
            }
            .padding(12)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(.background.secondary, in: RoundedRectangle(cornerRadius: 14))
        }
        .buttonStyle(.plain)
        .accessibilityHint("Shows the weather at every station")
    }

    private func end(_ name: String, caption: String, hour: WeatherHour?) -> some View {
        VStack(alignment: .leading, spacing: 3) {
            Text(name).font(.caption.weight(.semibold)).foregroundStyle(.secondary).lineLimit(1)
            if let h = hour {
                HStack(spacing: 6) {
                    WeatherIcon(hour: h).font(.title3)
                    Text("\(h.tempF)°").font(.title3.weight(.semibold).monospacedDigit())
                }
                Text("\(caption) · \(h.words)\(h.cond.isWet ? " \(h.pop)%" : "")").font(.caption).foregroundStyle(.secondary).lineLimit(1)
            } else {
                Text("—").font(.title3).foregroundStyle(.tertiary)
                Text(caption).font(.caption).foregroundStyle(.secondary)
            }
        }
        .accessibilityElement(children: .combine)
    }

    private var note: (text: String, symbol: String, color: Color)? {
        if let a = weather.alerts.first { return (a.headline, "exclamationmark.triangle.fill", .orange) }
        let wetFrom = weather.from.map { $0.cond.isWet && $0.pop >= 40 } ?? false
        let wetTo = weather.to.map { $0.cond.isWet && $0.pop >= 40 } ?? false
        if wetFrom || wetTo {
            let place = wetFrom && wetTo ? "at both ends" : wetFrom ? "at \(board.from.name)" : "when you get to \(board.to.name)"
            return ("Bring an umbrella: rain likely \(place).", "umbrella.fill", .blue)
        }
        if let f = weather.from, let t = weather.to, abs(f.tempF - t.tempF) >= 8 {
            return (t.tempF < f.tempF ? "\(f.tempF - t.tempF)° colder at \(board.to.name): bring a layer." : "\(t.tempF - f.tempF)° warmer at \(board.to.name).", "thermometer.medium", .secondary)
        }
        return nil
    }
}
