import Foundation
import MapKit
import Observation

@Observable
public final class AddressCompleter: NSObject, MKLocalSearchCompleterDelegate {
    public var query: String = "" {
        didSet {
            completer.queryFragment = query
        }
    }

    public private(set) var results: [MKLocalSearchCompletion] = []
    public var isSearching: Bool = false
    
    private let completer = MKLocalSearchCompleter()

    public override init() {
        super.init()
        completer.delegate = self
        completer.resultTypes = .address
    }

    public func completerDidUpdateResults(_ completer: MKLocalSearchCompleter) {
        self.results = completer.results
        self.isSearching = false
    }

    public func completer(_ completer: MKLocalSearchCompleter, didFailWithError error: Error) {
        self.results = []
        self.isSearching = false
    }

    public func resolveAddress(_ completion: MKLocalSearchCompletion, onComplete: @escaping (String) -> Void) {
        let request = MKLocalSearch.Request(completion: completion)
        let search = MKLocalSearch(request: request)

        search.start { response, error in
            guard let item = response?.mapItems.first?.placemark else {
                onComplete(completion.title + ", " + completion.subtitle)
                return
            }

            let streetNumber = item.subThoroughfare ?? ""
            let streetName = item.thoroughfare ?? ""
            let street = "\(streetNumber) \(streetName)".trimmingCharacters(in: .whitespaces)
            let city = item.locality ?? ""
            let state = item.administrativeArea ?? ""
            let zip = item.postalCode ?? ""

            let parts = [street, city, "\(state) \(zip)".trimmingCharacters(in: .whitespaces)]
                .filter { !$0.isEmpty }
            
            let formatted = parts.joined(separator: ", ")
            onComplete(formatted.isEmpty ? completion.title : formatted)
        }
    }
}
