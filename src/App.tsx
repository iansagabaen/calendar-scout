import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Mail, ListChecks, CalendarCheck, Coffee, AlertCircle, ShieldCheck, Copy, Check } from "lucide-react";

export default function App() {
  const [copied, setCopied] = useState(false);
  const scoutEmail = "iansagabaen+calendarscout@gmail.com";

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(scoutEmail);
      setCopied(true);
      setTimeout(() => setCopied(false), 3000);
    } catch (err) {
      console.error("Failed to copy: ", err);
    }
  };

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.15,
      },
    },
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0 },
  };

  return (
    <div className="min-h-screen flex flex-col selection:bg-forest/10 selection:text-forest">
      {/* Toast Notification */}
      <AnimatePresence>
        {copied && (
          <motion.div
            initial={{ opacity: 0, y: 50, x: "-50%" }}
            animate={{ opacity: 1, y: 0, x: "-50%" }}
            exit={{ opacity: 0, y: 20, x: "-50%" }}
            className="fixed bottom-8 left-1/2 z-50 bg-forest text-warm-white px-6 py-3 rounded-2xl shadow-2xl flex items-center gap-3 pointer-events-none"
          >
            <Check size={18} className="text-scout-bg" />
            <span className="font-medium">Email address copied to clipboard</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Navigation / Logo */}
      <nav className="p-4 md:p-6">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-forest rounded-full flex items-center justify-center text-warm-white">
              <CalendarCheck size={16} />
            </div>
            <span className="font-serif text-lg font-semibold tracking-tight">Your Calendar Scout</span>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <main className="flex-grow">
        <section className="px-6 py-8 md:py-12 max-w-7xl mx-auto">
          <motion.div 
            initial="hidden"
            animate="visible"
            variants={containerVariants}
            className="max-w-5xl"
          >
            <div className="flex flex-col md:flex-row items-center gap-8 md:gap-12 mb-10">
              <motion.h1 
                variants={itemVariants}
                className="text-5xl md:text-7xl font-medium leading-[1.1] tracking-tight flex-1 order-2 md:order-1"
              >
                From inbox to calendar in one tap
              </motion.h1>
              <motion.div 
                variants={itemVariants}
                className="shrink-0 w-64 h-64 md:w-[28rem] md:h-[28rem] order-1 md:order-2 overflow-hidden"
              >
                <img 
                  src="https://github.com/iansagabaen/calendar-scout/raw/refs/heads/main/image2vector%20(1).svg" 
                  alt="Calendar Scout Mascot" 
                  className="w-full h-full object-contain scale-110"
                  referrerPolicy="no-referrer"
                />
              </motion.div>
            </div>

            {/* Strong CTA Section */}
            <motion.div 
              variants={itemVariants}
              className="bg-scout-bg border border-scout-border rounded-[2.5rem] p-6 md:p-10 shadow-xl shadow-forest/5 relative overflow-hidden"
            >
              <div className="relative z-10">
                <div className="flex flex-col gap-4 text-2xl md:text-4xl font-serif italic text-forest/90 leading-tight mb-8">
                  <p>1. Find an email in your inbox</p>
                  <p>2. Forward it to:</p>
                  <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
                    <button 
                      onClick={copyToClipboard}
                      className="group relative flex items-center justify-between w-full sm:w-auto bg-forest text-warm-white px-8 py-5 rounded-2xl text-lg md:text-xl font-sans font-semibold not-italic hover:bg-olive transition-all duration-300 shadow-lg shadow-forest/20 active:scale-[0.98]"
                    >
                      <span className="mr-8">{scoutEmail}</span>
                      <div className="p-2 bg-white/10 rounded-lg group-hover:bg-white/20 transition-colors">
                        <Copy size={20} />
                      </div>
                    </button>
                  </div>
                  <p>3. Wait a few seconds for a reply</p>
                  <p className="text-olive font-bold">That's it!</p>
                </div>
              </div>
              
              {/* Decorative background element */}
              <div className="absolute top-0 right-0 -mr-20 -mt-20 w-64 h-64 bg-forest/5 rounded-full blur-3xl" />
              <div className="absolute bottom-0 left-0 -ml-20 -mb-20 w-64 h-64 bg-olive/5 rounded-full blur-3xl" />
            </motion.div>
          </motion.div>
        </section>

        {/* What the Scout is for */}
        <section className="py-12 px-6 border-t border-forest/5">
          <div className="max-w-3xl mx-auto">
            <h2 className="text-3xl md:text-4xl font-medium mb-4">What the Scout is for</h2>
            <div className="prose prose-forest prose-lg text-forest/70 leading-relaxed space-y-4">
              <p>
                The Scout is built to handle the messy details that usually get buried in your inbox. 
                It works best with long school newsletters, weekend sports practice schedules, and birthday party invitations.
              </p>
              <p>
                You can also forward PDF flyers for community events or neighborhood block parties. 
                If it has a date and a time, the Scout can find it.
              </p>
            </div>
          </div>
        </section>

        {/* Why I built this */}
        <section className="py-12 px-6 bg-scout-bg/50 border-y border-forest/5">
          <div className="max-w-3xl mx-auto">
            <h2 className="text-3xl md:text-4xl font-medium mb-4">Why I built this</h2>
            <div className="prose prose-forest prose-lg text-forest/70 leading-relaxed space-y-4">
              <p>
                I built the Calendar Scout because I was tired of "Newsletter Fatigue." 
                As a parent and a designer, I found myself constantly digging through long emails just to find one soccer practice time or a school minimum day.
              </p>
              <p>
                I wanted a way to bridge the gap between a cluttered inbox and a clean calendar without the manual data entry. 
                This tool is my way of making those small, daily tasks just a little bit easier for all of us.
              </p>
            </div>
          </div>
        </section>

        {/* Privacy Section */}
        <section className="py-12 md:py-16 px-6 max-w-4xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 text-olive mb-4">
            <ShieldCheck size={24} />
            <span className="uppercase tracking-widest text-xs font-bold">Privacy</span>
          </div>
          <p className="text-2xl md:text-3xl font-serif italic text-forest/80 leading-snug mb-8">
            We process your text, find your dates, and don't store your data. 
            No accounts to create, no apps to download.
          </p>
          <div className="max-w-2xl mx-auto text-sm text-forest/50 leading-relaxed space-y-3 text-left">
            <p>
              Calendar Scout is built on a pass-through architecture. We don't have a database that stores your name, your emails, or your calendar details. 
            </p>
            <p>
              When you forward an email, our AI reads it in real-time to find dates, generates your calendar links, and immediately forgets the content. We don't sell data, we don't train models on your personal info, and we don't read anything other than the specific emails you choose to send us.
            </p>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-forest/10 py-8 px-6">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-8">
          <div className="flex items-center gap-2 opacity-50">
            <CalendarCheck size={16} />
            <span className="font-serif text-sm">Your Calendar Scout</span>
          </div>
          
          <div className="flex items-center gap-8 text-sm font-medium">
            <a 
              href="https://forms.gle/687QErQW5soF9mCu8" 
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 hover:text-olive transition-colors underline underline-offset-4 decoration-forest/20"
            >
              <AlertCircle size={16} />
              Report an error or send feedback
            </a>
            <a 
              href="https://buymeacoffee.com/lionsaga" 
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 hover:text-olive transition-colors underline underline-offset-4 decoration-forest/20"
            >
              <Coffee size={16} />
              Buy me a coffee
            </a>
          </div>
          
          <div className="text-xs text-forest/40">
            © {new Date().getFullYear()}
          </div>
        </div>
      </footer>
    </div>
  );
}
