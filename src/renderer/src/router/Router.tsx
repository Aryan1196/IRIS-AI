import App from '@renderer/App'
import { BrowserRouter as BeowserRouter, Routes, Route } from 'react-router-dom'

const Router = () => {
  return (
    <>
      <BeowserRouter>
        <Routes>
          <Route path="/" element={<App />} />
        </Routes>
      </BeowserRouter>
    </>
  )
}

export default Router
