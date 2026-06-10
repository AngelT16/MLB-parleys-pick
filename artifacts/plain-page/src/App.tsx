import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import { motion, useScroll, useTransform } from "framer-motion";
import { useRef } from "react";

const queryClient = new QueryClient();

function FadeIn({ 
  children, 
  delay = 0, 
  className = "",
  direction = "up" 
}: { 
  children: React.ReactNode; 
  delay?: number; 
  className?: string;
  direction?: "up" | "down" | "none";
}) {
  const yOffset = direction === "up" ? 40 : direction === "down" ? -40 : 0;
  
  return (
    <motion.div
      initial={{ opacity: 0, y: yOffset }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-10%" }}
      transition={{ duration: 1.4, ease: [0.22, 1, 0.36, 1], delay }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

function Home() {
  const targetRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: targetRef,
    offset: ["start start", "end start"]
  });
  
  const y = useTransform(scrollYProgress, [0, 1], ["0%", "50%"]);
  const opacity = useTransform(scrollYProgress, [0, 0.5], [1, 0]);

  return (
    <div className="min-h-screen w-full bg-background text-foreground font-sans selection:bg-foreground selection:text-background overflow-x-hidden">
      
      {/* Hero Section */}
      <section ref={targetRef} className="relative min-h-[100dvh] flex flex-col items-center justify-center px-6 md:px-12 lg:px-24 overflow-hidden">
        <motion.div style={{ y, opacity }} className="flex flex-col items-center justify-center z-10 w-full max-w-5xl">
          <FadeIn>
            <h1 className="font-serif text-6xl sm:text-7xl md:text-8xl lg:text-[10rem] font-light tracking-tighter text-balance text-center leading-[1.05] text-foreground">
              A quiet place.
            </h1>
          </FadeIn>
        </motion.div>
        
        <FadeIn delay={0.8} className="absolute bottom-12 md:bottom-24 z-20 flex flex-col items-center gap-6">
          <span className="text-[10px] uppercase tracking-[0.3em] font-medium text-muted-foreground/60">Scroll slowly</span>
          <div className="w-[1px] h-16 md:h-24 bg-foreground/20 origin-top animate-in fade-in zoom-in slide-in-from-top-8 duration-1000 fill-mode-both" />
        </FadeIn>
      </section>

      {/* Statement Section */}
      <section className="min-h-[90dvh] flex items-center px-6 md:px-12 lg:px-24 max-w-[90rem] mx-auto py-24">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-16 lg:gap-24 items-center w-full">
          <div className="lg:col-span-5 lg:col-start-2 order-2 lg:order-1">
            <FadeIn>
              <div className="space-y-10 max-w-xl">
                <h2 className="font-serif text-4xl sm:text-5xl md:text-6xl font-light leading-[1.1] tracking-tight text-foreground">
                  Clarity emerges from empty space.
                </h2>
                <div className="space-y-6 text-muted-foreground text-lg sm:text-xl font-light leading-relaxed">
                  <p>
                    We spend our days surrounded by noise. Notifications, endless feeds, and digital clutter demanding our constant attention.
                  </p>
                  <p>
                    Here, there is nothing to ask of you. Just a single page, composed with care and intention. A moment of stillness in an otherwise chaotic world.
                  </p>
                </div>
              </div>
            </FadeIn>
          </div>
          
          <div className="lg:col-span-5 lg:col-start-8 order-1 lg:order-2">
            <FadeIn delay={0.2}>
              <div className="aspect-[3/4] w-full bg-muted/30 overflow-hidden relative group">
                <div className="absolute inset-0 bg-foreground/5 mix-blend-multiply z-10 transition-opacity duration-700 group-hover:opacity-0" />
                <img
                  src="/light.jpg"
                  alt="Natural light filtering through a window"
                  className="object-cover w-full h-full mix-blend-multiply opacity-90 transition-transform duration-[20s] ease-out group-hover:scale-110"
                />
              </div>
            </FadeIn>
          </div>
        </div>
      </section>

      {/* Quote Break */}
      <section className="py-32 md:py-48 px-6 md:px-12 lg:px-24">
        <FadeIn>
          <div className="w-full h-[60vh] md:h-[80vh] relative overflow-hidden flex items-center justify-center border border-foreground/5">
            <img
              src="/texture.jpg"
              alt="Subtle paper texture"
              className="absolute inset-0 w-full h-full object-cover opacity-30 mix-blend-luminosity grayscale"
            />
            <div className="relative z-10 text-center max-w-4xl px-6 md:px-12">
              <h3 className="font-serif text-3xl sm:text-4xl md:text-5xl lg:text-6xl leading-[1.3] font-light text-foreground text-balance">
                "The notes I handle no better than many pianists. But the pauses between the notes&mdash;ah, that is where the art resides."
              </h3>
              <p className="mt-12 text-xs sm:text-sm uppercase tracking-[0.2em] text-muted-foreground font-medium">
                Artur Schnabel
              </p>
            </div>
          </div>
        </FadeIn>
      </section>

      {/* Manifest Section */}
      <section className="py-24 md:py-48 px-6 md:px-12 lg:px-24 max-w-4xl mx-auto text-center">
        <FadeIn>
          <h2 className="font-serif text-3xl sm:text-4xl md:text-5xl font-light mb-16 tracking-tight text-foreground">
            The beauty of constraint.
          </h2>
        </FadeIn>
        
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-12 sm:gap-8 text-left">
          <FadeIn delay={0.1}>
            <div className="space-y-4">
              <div className="w-8 h-[1px] bg-foreground/30" />
              <h4 className="text-sm uppercase tracking-widest font-medium">Simplicity</h4>
              <p className="text-muted-foreground font-light leading-relaxed">
                Removing the non-essential until only what truly matters remains. A canvas stripped of excess.
              </p>
            </div>
          </FadeIn>
          
          <FadeIn delay={0.2}>
            <div className="space-y-4">
              <div className="w-8 h-[1px] bg-foreground/30" />
              <h4 className="text-sm uppercase tracking-widest font-medium">Focus</h4>
              <p className="text-muted-foreground font-light leading-relaxed">
                Directing attention to the quality of the typography, the tension of the layout, the rhythm of the scroll.
              </p>
            </div>
          </FadeIn>
          
          <FadeIn delay={0.3}>
            <div className="space-y-4">
              <div className="w-8 h-[1px] bg-foreground/30" />
              <h4 className="text-sm uppercase tracking-widest font-medium">Warmth</h4>
              <p className="text-muted-foreground font-light leading-relaxed">
                Minimalism need not be cold. Thoughtful colors and organic textures breathe life into the void.
              </p>
            </div>
          </FadeIn>
        </div>
      </section>

      {/* Conclusion */}
      <section className="min-h-[80dvh] flex flex-col items-center justify-center px-6 text-center relative border-t border-foreground/5 mt-24">
        <FadeIn>
          <div className="space-y-12">
            <h2 className="font-serif text-5xl sm:text-6xl md:text-7xl lg:text-8xl font-light tracking-tighter text-foreground">
              Breathe.
            </h2>
            <p className="text-muted-foreground text-lg sm:text-xl font-light">
              You have reached the end.
            </p>
            
            <div className="pt-12">
              <button 
                onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
                className="group inline-flex items-center gap-4 text-xs uppercase tracking-[0.2em] font-medium text-foreground/60 hover:text-foreground transition-colors"
              >
                <span className="w-8 h-[1px] bg-foreground/20 group-hover:bg-foreground/60 transition-colors" />
                Return to the top
                <span className="w-8 h-[1px] bg-foreground/20 group-hover:bg-foreground/60 transition-colors" />
              </button>
            </div>
          </div>
        </FadeIn>
      </section>
    </div>
  );
}

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <Router />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
