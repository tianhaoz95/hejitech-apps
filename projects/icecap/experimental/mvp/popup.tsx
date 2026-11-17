import { Calculator } from "lucide-react"
import "./style.css"

function IndexPopup() {
  const openSidePanel = () => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]?.id) {
        chrome.sidePanel.open({ tabId: tabs[0].id })
      }
    })
  }

  return (
    <div className="w-64 p-4 bg-gray-50 flex flex-col items-center gap-4">
      <div className="flex items-center gap-2 text-blue-600">
        <Calculator size={32} />
        <h1 className="text-xl font-bold">Icecap</h1>
      </div>
      <p className="text-sm text-gray-500 text-center">
        Analyze real estate deals instantly on Redfin.
      </p>
      <button 
        onClick={openSidePanel}
        className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-4 rounded-lg shadow-md transition-all"
      >
        Open Side Panel
      </button>
    </div>
  )
}

export default IndexPopup
