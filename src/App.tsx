import { Route, Routes } from 'react-router-dom'
import BlankMapPrototype from './BlankMapPrototype'
import CapitalsQuiz from './CapitalsQuiz'
import ClickQuiz from './ClickQuiz'
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
      <Route path="/click" element={<ClickQuiz />} />
      <Route path="/blank" element={<BlankMapPrototype />} />
    </Routes>
  )
}

export default App
