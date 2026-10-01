import { Route, Routes } from 'react-router-dom'
import CapitalsQuiz from './CapitalsQuiz'
import GlobeExplorer from './GlobeExplorer'
import Menu from './Menu'
import WorldQuiz from './WorldQuiz'

function App() {
  return (
    <Routes>
      <Route path="/" element={<Menu />} />
      <Route path="/quiz" element={<WorldQuiz />} />
      <Route path="/capitals" element={<CapitalsQuiz />} />
      <Route path="/explore" element={<GlobeExplorer />} />
    </Routes>
  )
}

export default App
