import { Route, Routes } from 'react-router-dom'
import CapitalsQuiz from './CapitalsQuiz'
import EmptyGlobe from './EmptyGlobe'
import EmptyMap2D from './EmptyMap2D'
import GlobeExplorer from './GlobeExplorer'
import Menu from './Menu'
import WorldQuiz from './WorldQuiz'

function App() {
  return (
    <Routes>
      <Route path="/" element={<Menu />} />
      <Route path="/countries" element={<WorldQuiz />} />
      <Route path="/capitals" element={<CapitalsQuiz />} />
      <Route path="/explore" element={<GlobeExplorer />} />
      <Route path="/blank" element={<EmptyGlobe />} />
      <Route path="/blank-2d" element={<EmptyMap2D />} />
    </Routes>
  )
}

export default App
