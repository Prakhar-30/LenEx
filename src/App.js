import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import Header from './components/Header';
import Home from './pages/Home';
import Swap from './pages/Swap';
import Liquidity from './pages/Liquidity';
import Lending from './pages/Lending';
import Pools from './pages/Pools';

function App() {
  return (
    <Router>
      <div className="App bg-black min-h-screen">
        <Header />
        <main>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/pools" element={<Pools />} />
            <Route path="/swap" element={<Swap />} />
            <Route path="/liquidity" element={<Liquidity />} />
            <Route path="/lending" element={<Lending />} />
          </Routes>
        </main>
        
        <Toaster
          position="top-right"
          toastOptions={{
            duration: 4000,
            style: {
              background: '#000',
              color: '#00f5ff',
              border: '1px solid #00f5ff',
              fontFamily: 'Orbitron, monospace',
            },
            success: {
              style: {
                background: '#000',
                color: '#39ff14',
                border: '1px solid #39ff14',
              },
            },
            error: {
              style: {
                background: '#000',
                color: '#ff1493',
                border: '1px solid #ff1493',
              },
            },
            loading: {
              style: {
                background: '#000',
                color: '#bf00ff',
                border: '1px solid #bf00ff',
              },
            },
          }}
        />
      </div>
    </Router>
  );
}

export default App;