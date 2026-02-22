import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Mail, ListChecks, CalendarCheck, Coffee, AlertCircle, ShieldCheck, Copy, Check, Trophy, Stethoscope, Home, Users, Briefcase } from "lucide-react";

export default function App() {
  const [copied, setCopied] = useState(false);
  const scoutEmail = "scoutmyemail@gmail.com";

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
        <section className="px-6 py-1 md:py-2 max-w-7xl mx-auto">
          <motion.div 
            initial="hidden"
            animate="visible"
            variants={containerVariants}
            className="max-w-5xl mx-auto"
          >
            <div className="flex flex-col md:flex-row items-center gap-4 md:gap-8 mb-4">
              <motion.h1 
                variants={itemVariants}
                className="text-3xl md:text-5xl font-medium leading-[1.1] tracking-tight flex-1 order-2 md:order-1"
              >
                From inbox to calendar in one tap
              </motion.h1>
              <motion.div 
                variants={itemVariants}
                className="shrink-0 w-40 h-40 md:w-80 md:h-80 order-1 md:order-2 overflow-hidden"
              >
                <img 
                  src="https://github.com/iansagabaen/calendar-scout/raw/refs/heads/main/image2vector%20(1).svg" 
                  alt="Calendar Scout Mascot" 
                  className="w-full h-full object-contain scale-125 mix-blend-multiply brightness-[1.08] contrast-[1.08]"
                  referrerPolicy="no-referrer"
                />
              </motion.div>
            </div>

            {/* Strong CTA Section */}
            <motion.div 
              variants={itemVariants}
              className="bg-scout-bg border border-scout-border rounded-[2.5rem] p-6 md:p-10 shadow-xl shadow-forest/5 relative overflow-hidden max-w-2xl mx-auto"
            >
              <div className="relative z-10">
                <div className="flex flex-col gap-4 text-2xl md:text-4xl font-serif italic text-forest/90 leading-tight mb-8">
                  <p>1. Find an email in your inbox</p>
                  <p>2. Forward it to:</p>
                  <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
                    <button 
                      onClick={copyToClipboard}
                      className="group relative flex items-center justify-between w-full sm:w-auto bg-forest text-warm-white px-4 sm:px-8 py-4 sm:py-5 rounded-2xl text-sm sm:text-lg md:text-xl font-sans font-semibold not-italic hover:bg-olive transition-all duration-300 shadow-lg shadow-forest/20 active:scale-[0.98]"
                    >
                      <span className="mr-4 sm:mr-8 truncate">{scoutEmail}</span>
                      <div className="shrink-0 p-2 bg-white/10 rounded-lg group-hover:bg-white/20 transition-colors">
                        <Copy size={18} className="sm:w-5 sm:h-5" />
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

        {/* What to Scout */}
        <section className="py-12 px-6 border-t border-forest/5">
          <div className="max-w-5xl mx-auto">
            <div className="max-w-3xl mb-10">
              <h2 className="text-3xl md:text-4xl font-medium mb-4">What to Scout</h2>
              <p className="text-lg text-forest/70">
                Here are a few examples of how the Scout can help you stay organized by turning cluttered emails into simple calendar events.
              </p>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-scout-bg/30 p-6 rounded-3xl border border-forest/5 hover:border-forest/10 transition-colors">
                <div className="w-10 h-10 bg-forest/10 text-forest rounded-xl flex items-center justify-center mb-4">
                  <Trophy size={20} />
                </div>
                <h3 className="text-xl font-semibold mb-2">Youth Sports and Extra-Curriculars</h3>
                <p className="text-forest/70 text-sm leading-relaxed">
                  Forward those long seasonal practice schedules or weekend tournament brackets to see every game listed as an individual event with the field location included.
                </p>
              </div>

              <div className="bg-scout-bg/30 p-6 rounded-3xl border border-forest/5 hover:border-forest/10 transition-colors">
                <div className="w-10 h-10 bg-forest/10 text-forest rounded-xl flex items-center justify-center mb-4">
                  <Stethoscope size={20} />
                </div>
                <h3 className="text-xl font-semibold mb-2">Medical and Wellness Appointments</h3>
                <p className="text-forest/70 text-sm leading-relaxed">
                  When you get a confirmation email for a dentist appointment or a specialist visit, the Scout can pull the date and time so you don't have to navigate fragmented medical portals.
                </p>
              </div>

              <div className="bg-scout-bg/30 p-6 rounded-3xl border border-forest/5 hover:border-forest/10 transition-colors">
                <div className="w-10 h-10 bg-forest/10 text-forest rounded-xl flex items-center justify-center mb-4">
                  <Home size={20} />
                </div>
                <h3 className="text-xl font-semibold mb-2">Home Maintenance and Services</h3>
                <p className="text-forest/70 text-sm leading-relaxed">
                  Use it for those window cleaning reminders or HVAC service windows so you can track your home maintenance schedule without manual entry.
                </p>
              </div>

              <div className="bg-scout-bg/30 p-6 rounded-3xl border border-forest/5 hover:border-forest/10 transition-colors">
                <div className="w-10 h-10 bg-forest/10 text-forest rounded-xl flex items-center justify-center mb-4">
                  <Users size={20} />
                </div>
                <h3 className="text-xl font-semibold mb-2">Community and Social Events</h3>
                <p className="text-forest/70 text-sm leading-relaxed">
                  Forward invitations for neighborhood block parties or local library events to quickly handle the RSVP nightmare and see who needs to bring what.
                </p>
              </div>

              <div className="bg-scout-bg/30 p-6 rounded-3xl border border-forest/5 hover:border-forest/10 transition-colors md:col-span-2">
                <div className="w-10 h-10 bg-forest/10 text-forest rounded-xl flex items-center justify-center mb-4">
                  <Briefcase size={20} />
                </div>
                <h3 className="text-xl font-semibold mb-2">Work-Life Integration</h3>
                <p className="text-forest/70 text-sm leading-relaxed">
                  If you work in a field-heavy job like landscaping or HVAC and receive job details via email, the Scout can turn those messages into calendar entries while you are away from your desk.
                </p>
              </div>
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
