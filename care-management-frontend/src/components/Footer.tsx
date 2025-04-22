const Footer: React.FC = () => {
  return (
    <footer className="footer mt-auto">
      <div className="footer-container">
        <p className="text-sm">
          © {new Date().getFullYear()}{" "}
          <span className="text-orange font-semibold">Pace the Case</span>. All rights reserved.
        </p>
      </div>
    </footer>
  );
};

export default Footer;
