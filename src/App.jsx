import './App.css';
import { Routes, Route, HashRouter } from 'react-router-dom';
import { useState } from 'react';
import { useEffect } from 'react';
import React from 'react';
import 'aos/dist/aos.css';
import AOS from 'aos';
import Home from './components/Home';

function App () {

  useEffect(()=> {
    AOS.init({
      duration:1200,
      easing: 'ease-in-out',
    })
  }, [] );

  return(
    <HashRouter>
      <Routes>
        <Route path='/' element={< Home />} />
      </Routes>
    </HashRouter>
  )
}

export default App;


