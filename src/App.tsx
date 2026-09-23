import { Route, Routes } from 'react-router-dom'
import GlobeExplorer from './GlobeExplorer'
import WorldQuiz from './WorldQuiz'

function App() {
  return (
    <Routes>
      <Route path="/" element={<GlobeExplorer />} />
      <Route path="/quiz" element={<WorldQuiz />} />
    </Routes>
  )
}

export default App
