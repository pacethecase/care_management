import Footer from "../components/Footer";

import React, { useEffect } from 'react';
import { Link } from 'react-router-dom';
import DischargeBarriers from "../components/DischargeBarriers";
import Navbar from "../components/Navbar";
import { useDispatch, useSelector } from 'react-redux';

import { RootState } from '../redux/store';
const HomePage = () => {
    const { user } = useSelector((state: RootState) => state.user); 
 useEffect(() => {
    console.log("User from Redux:", user);
});
  return (
    <div className="flex flex-col min-h-screen bg-hospital-neutral text-hospital-blue">
<Navbar/>
      <div className="container p-4">
        <div className="row">
          <div className="col-md-12">
     Welcome
          </div>
        </div>
       
      </div>
      <Footer />
    </div>
  );
};

export default HomePage;
