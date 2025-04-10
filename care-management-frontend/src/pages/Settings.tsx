import Footer from "../components/Footer";
import Navbar from "../components/NavBar"

const Settings = () => {
return(
    <div className="flex flex-col  min-h-screen bg-hospital-neutral text-hospital-dark">
    <Navbar />
<div className="container">
    <div className="row">
        <div className="col-md-12">
            <h1 className="text-center">Settings</h1>
        </div>
    </div>
</div>
 <Footer />
 </div>
);
};

export default Settings;