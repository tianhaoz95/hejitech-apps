import { HashRouter, Routes, Route } from 'react-router-dom'
import { Gallery } from './pages/Gallery'
import { RedfinMockup } from './mockups/RedfinMockup'
import { ZillowMockup } from './mockups/ZillowMockup'
import { RealtorMockup } from './mockups/RealtorMockup'
import { HubMockup } from './mockups/HubMockup'
import { SplitImage } from './mockups/SplitImage'

// The promo studio: mockups for store screenshots and ads. Nothing private, so no sign-in.
function AppShell() {
  return (
    <div className="relative">
      <Routes>
        <Route path="/" element={<Gallery />} />
        <Route path="/mockup/redfin" element={<RedfinMockup />} />
        <Route path="/mockup/zillow" element={<ZillowMockup />} />
        <Route path="/mockup/realtor" element={<RealtorMockup />} />
        <Route path="/mockup/hub" element={<HubMockup />} />
        <Route path="/split" element={<SplitImage />} />
      </Routes>
    </div>
  )
}

export default function App() {
  return (
    <HashRouter>
      <AppShell />
    </HashRouter>
  )
}
