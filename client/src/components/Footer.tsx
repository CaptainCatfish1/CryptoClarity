import { Building, LifeBuoy, ChevronRight } from "lucide-react";
import ContactForm from "./ContactForm";
import Logo from "./Logo";
import { useState, useEffect } from "react";

export default function Footer() {
  const [showContact, setShowContact] = useState(false);
  
  // Listen for global events to show contact form
  useEffect(() => {
    const handleShowContactForm = () => {
      setShowContact(true);
      
      // Use setTimeout to allow the component to re-render with showContact=true
      // before attempting to scroll
      setTimeout(() => {
        // Scroll to the contact form area after it's rendered
        const contactElement = document.getElementById('contact-form-area');
        if (contactElement) {
          contactElement.scrollIntoView({ behavior: 'smooth' });
        }
      }, 100);
    };
    
    window.addEventListener('showContactForm', handleShowContactForm);
    
    return () => {
      window.removeEventListener('showContactForm', handleShowContactForm);
    };
  }, []);
  
  return (
    <footer className="mt-auto bg-black/40 border-t border-gray-800 text-white py-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        {showContact ? (
          <div className="mb-12" id="contact-form-area">
            <h2 className="text-2xl font-bold text-center mb-8 bg-gradient-to-r from-purple-400 to-blue-400 bg-clip-text text-transparent">
              Contact Our Team
            </h2>
            <ContactForm />
            <div className="flex justify-center mt-6">
              <button 
                onClick={() => setShowContact(false)}
                className="text-sm text-gray-400 hover:text-white flex items-center"
              >
                <span>Close Contact Form</span>
              </button>
            </div>
          </div>
        ) : (
          <div className="flex justify-center mb-12">
            <div className="text-center max-w-lg">
              <div className="flex justify-center mb-4">
                <Logo size="small" />
              </div>
              <p className="text-gray-400 text-sm mb-6">
                Making crypto easier to understand and safer to use. We're here to help you navigate the blockchain world with confidence.
              </p>
              <button 
                onClick={() => setShowContact(true)} 
                className="text-sm text-purple-400 hover:text-purple-300 flex items-center justify-center mx-auto"
              >
                <LifeBuoy className="w-4 h-4 mr-1.5" />
                <span>Contact Us</span>
                <ChevronRight className="w-3 h-3 ml-1" />
              </button>
            </div>
          </div>
        )}
        
        <div className="pt-8 border-t border-gray-800 text-center">
          <div className="flex items-center justify-center text-gray-500 mb-4">
            <Building className="h-4 w-4 mr-2" />
            <p className="text-sm">
              Crypto Clarity is created by Hayward Digital LLC in Baltimore, MD. We're on a mission to make cryptocurrency accessible to everyone.
            </p>
          </div>
          <p className="text-gray-600 text-xs">
            © {new Date().getFullYear()} Crypto Clarity by Hayward Digital LLC. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}
