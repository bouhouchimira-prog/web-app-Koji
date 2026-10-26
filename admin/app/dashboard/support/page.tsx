import { 
  Search, Bell, HelpCircle, AlertCircle, CheckCircle2, 
  Clock, Sparkles, Database, Shield, Zap, LayoutGrid, Server, 
  Terminal, Trash2, Plus, LogOut, ArrowRight, Activity, ArrowUpRight, RefreshCw
} from 'lucide-react'

export default function SupportPage() {
  return (
    <div className="space-y-8 pb-32 xl:pb-10 relative h-full min-h-screen">
      {/* En-tete (25 oct) : recherche/notifications/compte deplacees dans la
          barre partagee TopBar (components/layout/TopBar.tsx). Page retiree
          de la sidebar (absente de la nouvelle maquette) mais laissee
          accessible par URL directe. */}
      <div className="mb-2">
        <h1 className="text-[26px] font-extrabold text-[#16233F] tracking-tight">Support &amp; Bugs</h1>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 items-start">
        {/* KPI 1 */}
        <div className="bg-white rounded-[1.5rem] p-7 border border-gray-100 shadow-[0_4px_20px_rgb(0,0,0,0.02)] flex flex-col h-[180px]">
          <div className="w-10 h-10 rounded-xl bg-red-50 flex items-center justify-center text-[#D93036] mb-auto">
            <AlertCircle className="w-5 h-5 stroke-[2]" />
          </div>
          <span className="text-[11px] font-bold text-gray-400 uppercase tracking-widest block mb-1">Tickets Ouverts</span>
          <span className="text-[32px] font-bold text-[#0E172C] font-outfit leading-none tracking-tight block">12</span>
        </div>

        {/* KPI 2 */}
        <div className="bg-white rounded-[1.5rem] p-7 border border-gray-100 shadow-[0_4px_20px_rgb(0,0,0,0.02)] flex flex-col h-[180px]">
          <div className="w-10 h-10 rounded-xl bg-[#F0F4FF] flex items-center justify-center text-[#1D5FE1] mb-auto">
            <Clock className="w-5 h-5 stroke-[2]" />
          </div>
          <span className="text-[11px] font-bold text-gray-400 uppercase tracking-widest block mb-1">En Cours</span>
          <span className="text-[32px] font-bold text-[#0E172C] font-outfit leading-none tracking-tight block">24</span>
        </div>

        {/* KPI 3 */}
        <div className="bg-white rounded-[1.5rem] p-7 border border-gray-100 shadow-[0_4px_20px_rgb(0,0,0,0.02)] flex flex-col h-[180px]">
          <div className="w-10 h-10 rounded-xl bg-[#ECFDF5] flex items-center justify-center text-[#10B981] mb-auto">
            <CheckCircle2 className="w-5 h-5 stroke-[2]" />
          </div>
          <span className="text-[11px] font-bold text-gray-400 uppercase tracking-widest block mb-1">Résolus (24h)</span>
          <span className="text-[32px] font-bold text-[#0E172C] font-outfit leading-none tracking-tight block">48</span>
        </div>

        {/* Expert Banner */}
        <div className="bg-[#1b62f8] bg-gradient-to-br from-[#1753d1] to-[#2573ff] rounded-[1.5rem] p-7 shadow-lg text-white flex flex-col h-[180px] justify-between">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-white/20 rounded-full text-[10px] font-bold tracking-widest uppercase backdrop-blur-sm border border-white/10 self-start">
            <Sparkles className="w-3 h-3 fill-white/80" /> Conseil Expert
          </div>
          <h3 className="font-bold text-[15px] leading-snug tracking-wide">
            Optimisez le temps de réponse en utilisant les tags de priorité automatique.
          </h3>
          <button className="bg-white/20 hover:bg-white/30 backdrop-blur-md text-white font-bold rounded-full px-5 py-2 hover:px-6 transition-all text-[11px] shadow-sm self-start inline-flex items-center">
            En savoir plus
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between mb-2">
            <h3 className="font-bold text-[20px] text-[#0E172C] font-outfit">Tickets récents</h3>
            <div className="flex items-center gap-1 bg-gray-50/80 p-1.5 rounded-full border border-gray-100">
              <button className="px-5 py-1.5 bg-white text-gray-900 rounded-full text-[12px] font-bold shadow-sm border border-gray-100/50">Tous</button>
              <button className="px-5 py-1.5 text-gray-500 hover:text-gray-700 rounded-full text-[12px] font-bold transition-colors">Haute Priorité</button>
              <button className="px-5 py-1.5 text-gray-500 hover:text-gray-700 rounded-full text-[12px] font-bold transition-colors">Non Traités</button>
            </div>
          </div>

          <div className="bg-white rounded-[1.5rem] border border-gray-100 shadow-[0_4px_20px_rgb(0,0,0,0.02)] overflow-hidden">
             
             {/* Ticket 1 Urgent */}
             <div className="p-6 border-b border-gray-50 flex items-start gap-4 hover:bg-gray-50/30 transition-colors relative group">
                <div className="absolute left-0 top-0 bottom-0 w-1 bg-[#D93036]"></div>
                <div className="flex-1">
                   <div className="flex items-start justify-between mb-2">
                     <h4 className="font-bold text-[#0E172C] text-[15px]">Erreur 500 lors de la génération de facture PDF</h4>
                     <span className="bg-red-50 text-[#D93036] px-2.5 py-0.5 rounded-md text-[10px] font-black tracking-widest uppercase">Urgent</span>
                   </div>
                   <div className="flex items-center gap-4 text-[12px] text-gray-400 font-medium mb-3">
                     <span className="flex items-center gap-1.5 text-gray-500"><div className="w-5 h-5 bg-gray-200 rounded-full"></div> Jean-Marc D.</span>
                     <span className="flex items-center gap-1.5"><Clock className="w-3.5 h-3.5" /> il y a 14 minutes</span>
                     <span>#TK-982</span>
                   </div>
                   <p className="text-[13px] text-gray-600 font-medium leading-relaxed max-w-2xl">
                     Le service de facturation échoue systématiquement pour les...
                   </p>
                </div>
                <div className="flex flex-col items-end gap-3 min-w-[120px]">
                   <span className="inline-flex items-center gap-1.5 bg-gray-100 px-3 py-1 rounded-full text-[11px] font-bold text-gray-600">
                     <div className="w-2 h-2 rounded-full bg-[#D93036]"></div> Ouvert
                   </span>
                   <button className="text-[#1D5FE1] font-bold text-[13px] group-hover:underline flex items-center mt-auto whitespace-nowrap">
                     Traiter le ticket <ArrowRight className="w-4 h-4 ml-1" />
                   </button>
                </div>
             </div>

             {/* Ticket 2 Moyenne */}
             <div className="p-6 border-b border-gray-50 flex items-start gap-4 hover:bg-gray-50/30 transition-colors relative group">
                <div className="absolute left-0 top-0 bottom-0 w-1 bg-[#1D5FE1]"></div>
                <div className="flex-1">
                   <div className="flex items-start justify-between mb-2">
                     <h4 className="font-bold text-[#0E172C] text-[15px]">Mise à jour des tarifs - Latence interface</h4>
                     <span className="bg-[#F0F4FF] text-[#1D5FE1] px-2.5 py-0.5 rounded-md text-[10px] font-black tracking-widest uppercase">Moyenne</span>
                   </div>
                   <div className="flex items-center gap-4 text-[12px] text-gray-400 font-medium mb-3">
                     <span className="flex items-center gap-1.5 text-gray-500"><div className="w-5 h-5 bg-gray-200 rounded-full"></div> Sophie M.</span>
                     <span className="flex items-center gap-1.5"><Clock className="w-3.5 h-3.5" /> il y a 2 heures</span>
                     <span>#TK-980</span>
                   </div>
                   <p className="text-[13px] text-gray-600 font-medium leading-relaxed max-w-2xl">
                     L'interface se fige pendant 3-5 secondes lors de...
                   </p>
                </div>
                <div className="flex flex-col items-end gap-3 min-w-[120px]">
                   <span className="inline-flex items-center gap-1.5 bg-[#F0F4FF] px-3 py-1 rounded-full text-[11px] font-bold text-[#1D5FE1]">
                     <div className="w-2 h-2 rounded-full bg-[#1D5FE1]"></div> En cours
                   </span>
                   <button className="text-[#1D5FE1] font-bold text-[13px] group-hover:underline flex items-center mt-auto whitespace-nowrap">
                     Voir détails <ArrowRight className="w-4 h-4 ml-1" />
                   </button>
                </div>
             </div>

             {/* Ticket 3 Basse */}
             <div className="p-6 border-b border-gray-50 flex items-start gap-4 hover:bg-gray-50/30 transition-colors relative group opacity-70">
                <div className="absolute left-0 top-0 bottom-0 w-1 bg-gray-300"></div>
                <div className="flex-1">
                   <div className="flex items-start justify-between mb-2">
                     <h4 className="font-bold text-gray-700 text-[15px] line-through decoration-1 decoration-gray-400/50">Problème d'affichage avatar utilisateur</h4>
                     <span className="bg-gray-100 text-gray-500 px-2.5 py-0.5 rounded-md text-[10px] font-black tracking-widest uppercase">Basse</span>
                   </div>
                   <div className="flex items-center gap-4 text-[12px] text-gray-400 font-medium mb-3">
                     <span className="flex items-center gap-1.5"><div className="w-5 h-5 bg-gray-200 rounded-full"></div> Pierre K.</span>
                     <span className="flex items-center gap-1.5"><Clock className="w-3.5 h-3.5" /> Hier, 16:45</span>
                     <span>#TK-975</span>
                   </div>
                   <p className="text-[13px] text-gray-500 font-medium leading-relaxed max-w-2xl">
                     Certains avatars ne chargent pas sur Safari mobile. Cache...
                   </p>
                </div>
                <div className="flex flex-col items-end gap-3 min-w-[120px]">
                   <span className="inline-flex items-center gap-1 bg-white border border-gray-200 px-2 py-1 rounded-md text-[11px] font-bold text-gray-400">
                     <CheckCircle2 className="w-3.5 h-3.5 stroke-[3]" /> Résolu
                   </span>
                   <button className="text-gray-400 font-bold text-[12px] flex items-center mt-auto whitespace-nowrap hover:text-black">
                     Archiver <Trash2 className="w-3.5 h-3.5 ml-1" />
                   </button>
                </div>
             </div>

          </div>
        </div>

        <div className="space-y-6">
          <h3 className="font-bold text-[20px] text-[#0E172C] font-outfit mb-3 pl-1">Outils de Diagnostic</h3>
          
          <div className="bg-white rounded-[1.5rem] p-7 border border-gray-100 shadow-[0_4px_20px_rgb(0,0,0,0.02)]">
            <h4 className="text-[12px] font-bold text-gray-500 uppercase tracking-widest mb-6">État Des Services</h4>
            <div className="space-y-4">
               <div className="flex items-center justify-between">
                 <span className="text-[14px] font-bold text-[#0E172C]">API Core</span>
                 <span className="text-[12px] font-bold text-[#10B981]">99.9%</span>
               </div>
               <div className="flex items-center justify-between">
                 <span className="text-[14px] font-bold text-[#0E172C]">Auth Service</span>
                 <span className="text-[12px] font-bold text-[#10B981]">Optimal</span>
               </div>
               <div className="flex items-center justify-between">
                 <span className="text-[14px] font-bold text-[#0E172C]">Billing Engine</span>
                 <span className="text-[12px] font-bold text-[#F59E0B]">Latent</span>
               </div>
               <div className="flex items-center justify-between">
                 <span className="text-[14px] font-bold text-[#0E172C]">CDN Static</span>
                 <span className="bg-[#ECFDF5] text-[#10B981] px-2 py-0.5 rounded-sm text-[11px] font-black tracking-widest uppercase">Actif</span>
               </div>
            </div>
          </div>

          <div className="bg-white rounded-[1.5rem] p-7 border border-gray-100 shadow-[0_4px_20px_rgb(0,0,0,0.02)]">
            <h4 className="text-[12px] font-bold text-gray-500 uppercase tracking-widest mb-5">Action Rapide</h4>
            <div className="space-y-3">
              <button className="w-full flex items-center justify-between p-3.5 bg-gray-50 hover:bg-gray-100 rounded-xl group transition-colors">
                <div className="flex items-center gap-3 text-[#0E172C] font-bold text-[14px]">
                  <Terminal className="w-5 h-5 text-[#0E172C]" /> Logs Live
                </div>
                <ArrowUpRight className="w-4 h-4 text-gray-400 group-hover:text-[#0E172C] transition-colors" />
              </button>
              <button className="w-full flex items-center justify-between p-3.5 bg-[#F0F4FF] hover:bg-[#E5EDFF] rounded-xl group transition-colors">
                <div className="flex items-center gap-3 text-[#1D5FE1] font-bold text-[14px]">
                  <Database className="w-5 h-5 text-[#1D5FE1]" /> Vider le Cache
                </div>
                <Zap className="w-4 h-4 text-[#1D5FE1]" />
              </button>
              <button className="w-full flex items-center justify-between p-3.5 border border-red-100 hover:bg-red-50 rounded-xl group transition-colors">
                <div className="flex items-center gap-3 text-[#D93036] font-bold text-[14px] tracking-wide">
                  <AlertCircle className="w-5 h-5 text-[#D93036]" /> Redémarrer Core
                </div>
                <RefreshCw className="w-4 h-4 text-[#D93036]" />
              </button>
            </div>
          </div>

          <div className="bg-[#F0F4FF] rounded-[1.5rem] p-7 border border-[#1D5FE1]/10">
            <h4 className="text-[13px] font-bold text-[#1D5FE1] mb-4">Experts de garde</h4>
            <div className="flex items-center gap-3 mb-4">
              <div className="flex -space-x-2">
                 <div className="w-10 h-10 rounded-full border-2 border-white bg-gray-200 overflow-hidden shadow-sm">
                   <img src="https://api.dicebear.com/7.x/notionists/svg?seed=Tom" className="w-full h-full object-cover"/>
                 </div>
                 <div className="w-10 h-10 rounded-full border-2 border-white bg-gray-200 overflow-hidden shadow-sm">
                   <img src="https://api.dicebear.com/7.x/notionists/svg?seed=Julie" className="w-full h-full object-cover"/>
                 </div>
                 <div className="w-10 h-10 rounded-full border-2 border-white bg-white flex items-center justify-center shadow-sm text-[12px] font-bold text-[#1D5FE1]">
                   +2
                 </div>
              </div>
            </div>
            <p className="text-[12px] font-bold text-[#1D5FE1]/70 leading-relaxed max-w-[200px]">
              Besoin d'aide ? Julie et Marc sont disponibles pour une escalade de niveau 2.
            </p>
          </div>
        </div>
      </div>

      <button className="fixed bottom-10 right-10 w-[56px] h-[56px] rounded-full bg-[#1D5FE1] text-white flex items-center justify-center shadow-2xl hover:scale-105 transition-transform hover:shadow-blue-500/50 hover:bg-blue-700 z-50">
        <Plus className="w-7 h-7 stroke-[2.5]" />
      </button>

    </div>
  )
}
