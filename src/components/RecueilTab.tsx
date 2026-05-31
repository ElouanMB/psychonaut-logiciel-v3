import { useState, useEffect } from 'react';
import { recueilApi, Resource, ResourceItem } from '../utils/recueilApi';
import { Folder, FileText, Link as LinkIcon, Plus, ChevronRight, Edit2, Trash2, ArrowLeft } from 'lucide-react';

export function RecueilTab({ theme: _theme }: { theme: 'light' | 'dark' }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [apiKey, setApiKey] = useState(localStorage.getItem('recueilApiKey') || '');
  const [apiPassword, setApiPassword] = useState(localStorage.getItem('recueilApiPassword') || '');
  const [authError, setAuthError] = useState('');

  const [resources, setResources] = useState<Resource[]>([]);
  const [activeResource, setActiveResource] = useState<Resource | null>(null);
  const [items, setItems] = useState<ResourceItem[]>([]);
  const [loading, setLoading] = useState(false);

  // Forms
  const [isCreatingFolder, setIsCreatingFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');

  const [isCreatingItem, setIsCreatingItem] = useState(false);
  const [itemType, setItemType] = useState<'note' | 'link'>('note');
  const [itemTitle, setItemTitle] = useState('');
  const [itemContent, setItemContent] = useState('');
  const [itemUrl, setItemUrl] = useState('');
  const [itemLang, setItemLang] = useState('français');

  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [editItemTitle, setEditItemTitle] = useState('');
  const [editItemContent, setEditItemContent] = useState('');
  const [editItemUrl, setEditItemUrl] = useState('');
  const [editItemLang, setEditItemLang] = useState('français');

  useEffect(() => {
    const handleUpdate = () => {
      setApiKey(localStorage.getItem('recueilApiKey') || '');
      setApiPassword(localStorage.getItem('recueilApiPassword') || '');
    };
    window.addEventListener('recueilUpdated', handleUpdate);
    return () => window.removeEventListener('recueilUpdated', handleUpdate);
  }, []);

  useEffect(() => {
    if (apiKey && apiPassword) {
      checkAuthAndLoad();
    } else {
      setIsAuthenticated(false);
    }
  }, [apiKey, apiPassword]);

  const checkAuthAndLoad = async () => {
    setLoading(true);
    setAuthError('');
    try {
      const res = await recueilApi.getResources();
      setResources(res);
      setIsAuthenticated(true);
    } catch (err: any) {
      // invoke() de Tauri rejette avec une string, pas un Error object
      setAuthError(err?.message || String(err) || 'Erreur de connexion');
      setIsAuthenticated(false);
    } finally {
      setLoading(false);
    }
  };


  const loadResourceItems = async (res: Resource) => {
    setActiveResource(res);
    setLoading(true);
    try {
      const fetchedItems = await recueilApi.getResourceItems(res.id);
      setItems(fetchedItems);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateFolder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFolderName.trim()) return;
    try {
      await recueilApi.createResource(newFolderName);
      setNewFolderName('');
      setIsCreatingFolder(false);
      checkAuthAndLoad(); // reload folders
      window.dispatchEvent(new CustomEvent('recueilUpdated'));
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteFolder = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (window.confirm("Êtes-vous sûr de vouloir supprimer ce dossier et tout son contenu ?")) {
      try {
        await recueilApi.deleteResource(id);
        if (activeResource?.id === id) setActiveResource(null);
        checkAuthAndLoad();
        window.dispatchEvent(new CustomEvent('recueilUpdated'));
      } catch (err) {
        console.error(err);
      }
    }
  };

  const handleCreateItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeResource || !itemTitle.trim()) return;
    
    try {
      await recueilApi.createItem({
        resource_id: activeResource.id,
        type: itemType,
        title: itemTitle,
        content: itemType === 'note' ? itemContent : undefined,
        url: itemType === 'link' ? itemUrl : undefined,
        lang: itemType === 'link' ? itemLang : undefined,
      });
      setIsCreatingItem(false);
      setItemTitle('');
      setItemContent('');
      setItemUrl('');
      setItemLang('français');
      loadResourceItems(activeResource);
      window.dispatchEvent(new CustomEvent('recueilUpdated'));
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteItem = async (id: string) => {
    if (!activeResource) return;
    if (window.confirm("Supprimer cet élément ?")) {
      try {
        await recueilApi.deleteItem(id, activeResource.id);
        loadResourceItems(activeResource);
        window.dispatchEvent(new CustomEvent('recueilUpdated'));
      } catch (err) {
        console.error(err);
      }
    }
  };

  const handleStartEditItem = (item: ResourceItem) => {
    setEditingItemId(item.id);
    setEditItemTitle(item.title);
    setEditItemContent(item.content || '');
    setEditItemUrl(item.url || '');
    setEditItemLang(item.lang || 'français');
  };

  const handleSaveEditItem = async (e: React.FormEvent, itemType: 'note' | 'link') => {
    e.preventDefault();
    if (!editingItemId || !editItemTitle.trim() || !activeResource) return;
    try {
      await recueilApi.updateItem(editingItemId, {
        title: editItemTitle,
        content: itemType === 'note' ? editItemContent : undefined,
        url: itemType === 'link' ? editItemUrl : undefined,
        lang: itemType === 'link' ? editItemLang : undefined,
      });
      setEditingItemId(null);
      loadResourceItems(activeResource);
      window.dispatchEvent(new CustomEvent('recueilUpdated'));
    } catch (err) {
      console.error(err);
    }
  };

  if (!isAuthenticated) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 overflow-y-auto">
        <div className="bg-chrome-bg border border-border-main p-8 rounded-xl shadow-lg w-full max-w-md text-center">
          <div className="mx-auto w-12 h-12 bg-accent/10 flex items-center justify-center rounded-full mb-4">
            <Folder className="w-6 h-6 text-accent" />
          </div>
          <h2 className="text-xl font-bold mb-2">Recueil de Données</h2>
          <p className="text-sm text-fg-muted mb-6">
            Vous n'êtes pas connecté au Recueil.
          </p>
          {authError && <div className="text-red-500 mb-6 text-sm bg-red-500/10 p-3 rounded-lg border border-red-500/20">{authError}</div>}
          <div className="bg-editor-bg border border-border-main p-4 rounded-lg text-sm text-fg-secondary">
            Veuillez renseigner votre Clé API et votre Mot de passe dans les paramètres de l'application (l'icône d'engrenage en haut à droite).
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden">
      {/* Header toolbar */}
      <div className="h-12 border-b border-border-main bg-chrome-bg shrink-0 flex items-center px-4 justify-between select-none">
        <div className="flex items-center gap-2 text-sm font-medium">
          {activeResource ? (
            <>
              <button 
                onClick={() => setActiveResource(null)}
                className="hover:text-accent flex items-center gap-1 text-fg-secondary transition-colors"
              >
                <ArrowLeft className="w-4 h-4" /> Recueil
              </button>
              <ChevronRight className="w-4 h-4 text-fg-muted" />
              <span className="text-fg-main flex items-center gap-2">
                <Folder className="w-4 h-4 text-accent" /> {activeResource.title}
              </span>
            </>
          ) : (
            <span className="text-fg-main flex items-center gap-2">
              <Folder className="w-4 h-4 text-accent" /> Dossiers du Recueil
            </span>
          )}
        </div>
        <div>
          {!activeResource && (
            <button
              onClick={() => setIsCreatingFolder(true)}
              className="flex items-center gap-2 px-3 py-1.5 bg-accent/10 hover:bg-accent/20 text-accent rounded-md text-sm font-medium transition-colors"
            >
              <Plus className="w-4 h-4" /> Nouveau Dossier
            </button>
          )}
          {activeResource && (
             <button
              onClick={() => setIsCreatingItem(true)}
              className="flex items-center gap-2 px-3 py-1.5 bg-accent/10 hover:bg-accent/20 text-accent rounded-md text-sm font-medium transition-colors"
             >
               <Plus className="w-4 h-4" /> Ajouter Note / Lien
             </button>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6 relative">
        {loading && <div className="absolute inset-0 bg-editor-bg/50 backdrop-blur-sm flex justify-center items-center z-10">Chargement...</div>}
        
        {!activeResource ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {isCreatingFolder && (
              <form onSubmit={handleCreateFolder} className="bg-chrome-bg border border-accent/50 p-4 rounded-xl shadow-sm">
                <input
                  autoFocus
                  type="text"
                  placeholder="Nom du dossier..."
                  value={newFolderName}
                  onChange={e => setNewFolderName(e.target.value)}
                  className="w-full bg-editor-bg border border-border-main rounded-md px-3 py-2 text-sm mb-3 focus:outline-none focus:border-accent"
                />
                <div className="flex gap-2">
                  <button type="submit" className="flex-1 bg-accent text-white py-1.5 rounded text-sm font-medium">Créer</button>
                  <button type="button" onClick={() => setIsCreatingFolder(false)} className="flex-1 border border-border-main py-1.5 rounded text-sm font-medium text-fg-secondary">Annuler</button>
                </div>
              </form>
            )}

            {resources.map(res => (
              <div 
                key={res.id}
                onClick={() => loadResourceItems(res)}
                className="group bg-chrome-bg border border-border-main hover:border-accent/50 p-4 rounded-xl shadow-sm cursor-pointer transition-all hover:shadow-md flex flex-col h-32 relative"
              >
                <button 
                  onClick={(e) => handleDeleteFolder(e, res.id)}
                  className="absolute top-3 right-3 text-fg-muted hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
                <div className="flex items-center gap-3 mb-auto">
                  <div className="p-2 bg-accent/10 rounded-lg">
                    <Folder className="w-6 h-6 text-accent" />
                  </div>
                  <h3 className="font-semibold text-fg-main truncate pr-6">{res.title}</h3>
                </div>
                <div className="text-xs text-fg-muted mt-4">
                  Dernier éditeur: <span className="font-medium text-fg-secondary">{res.last_editor || 'Inconnu'}</span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div>
            {isCreatingItem && (
               <div className="mb-6 bg-chrome-bg border border-border-main p-5 rounded-xl shadow-sm">
                 <h3 className="font-semibold text-lg mb-4">Ajouter un élément</h3>
                 <form onSubmit={handleCreateItem} className="space-y-4">
                    <div className="flex gap-4">
                      <label className="flex items-center gap-2 cursor-pointer text-sm">
                        <input type="radio" checked={itemType === 'note'} onChange={() => setItemType('note')} className="accent-accent" />
                        <FileText className="w-4 h-4 text-accent" /> Note textuelle
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer text-sm">
                        <input type="radio" checked={itemType === 'link'} onChange={() => setItemType('link')} className="accent-accent" />
                        <LinkIcon className="w-4 h-4 text-blue-500" /> Lien externe
                      </label>
                    </div>

                    <div>
                      <input
                        type="text"
                        placeholder="Titre"
                        value={itemTitle}
                        onChange={e => setItemTitle(e.target.value)}
                        className="w-full bg-editor-bg border border-border-main rounded-md px-3 py-2 text-sm focus:outline-none focus:border-accent"
                        required
                      />
                    </div>

                    {itemType === 'note' ? (
                      <div>
                        <textarea
                          placeholder="Contenu de la note..."
                          value={itemContent}
                          onChange={e => setItemContent(e.target.value)}
                          className="w-full bg-editor-bg border border-border-main rounded-md px-3 py-2 text-sm h-32 resize-y focus:outline-none focus:border-accent font-mono"
                          required
                        />
                      </div>
                    ) : (
                      <div className="flex gap-4">
                         <input
                          type="url"
                          placeholder="https://..."
                          value={itemUrl}
                          onChange={e => setItemUrl(e.target.value)}
                          className="flex-1 bg-editor-bg border border-border-main rounded-md px-3 py-2 text-sm focus:outline-none focus:border-accent"
                          required
                        />
                        <select
                          value={itemLang}
                          onChange={e => setItemLang(e.target.value)}
                          className="w-32 bg-editor-bg border border-border-main rounded-md px-3 py-2 text-sm focus:outline-none focus:border-accent"
                        >
                          <option value="français">Français</option>
                          <option value="anglais">Anglais</option>
                        </select>
                      </div>
                    )}

                    <div className="flex justify-end gap-2 pt-2">
                      <button type="button" onClick={() => setIsCreatingItem(false)} className="px-4 py-2 text-sm font-medium text-fg-secondary hover:text-fg-main">Annuler</button>
                      <button type="submit" className="px-4 py-2 bg-accent text-white rounded-md text-sm font-medium hover:bg-accent-hover transition-colors">Enregistrer</button>
                    </div>
                 </form>
               </div>
            )}

            <div className="space-y-4">
              {items.length === 0 && !isCreatingItem && (
                <div className="text-center text-fg-muted py-12">Ce dossier est vide.</div>
              )}
              {items.map(item => (
                <div key={item.id} className="bg-chrome-bg border border-border-main p-4 rounded-xl shadow-sm flex flex-col gap-3 group relative">
                  {editingItemId === item.id ? (
                    <form onSubmit={(e) => handleSaveEditItem(e, item.type)} className="space-y-4">
                      <div>
                        <input
                          type="text"
                          placeholder="Titre"
                          value={editItemTitle}
                          onChange={e => setEditItemTitle(e.target.value)}
                          className="w-full bg-editor-bg border border-border-main rounded-md px-3 py-2 text-sm focus:outline-none focus:border-accent"
                          required
                        />
                      </div>
                      {item.type === 'note' ? (
                        <div>
                          <textarea
                            placeholder="Contenu de la note..."
                            value={editItemContent}
                            onChange={e => setEditItemContent(e.target.value)}
                            className="w-full bg-editor-bg border border-border-main rounded-md px-3 py-2 text-sm h-32 resize-y focus:outline-none focus:border-accent font-mono"
                            required
                          />
                        </div>
                      ) : (
                        <div className="flex gap-4">
                           <input
                            type="url"
                            placeholder="https://..."
                            value={editItemUrl}
                            onChange={e => setEditItemUrl(e.target.value)}
                            className="flex-1 bg-editor-bg border border-border-main rounded-md px-3 py-2 text-sm focus:outline-none focus:border-accent"
                            required
                          />
                          <select
                            value={editItemLang}
                            onChange={e => setEditItemLang(e.target.value)}
                            className="w-32 bg-editor-bg border border-border-main rounded-md px-3 py-2 text-sm focus:outline-none focus:border-accent"
                          >
                            <option value="français">Français</option>
                            <option value="anglais">Anglais</option>
                          </select>
                        </div>
                      )}
                      <div className="flex justify-end gap-2 pt-2">
                        <button type="button" onClick={() => setEditingItemId(null)} className="px-4 py-2 text-sm font-medium text-fg-secondary hover:text-fg-main">Annuler</button>
                        <button type="submit" className="px-4 py-2 bg-accent text-white rounded-md text-sm font-medium hover:bg-accent-hover transition-colors">Enregistrer</button>
                      </div>
                    </form>
                  ) : (
                    <>
                      <div className="absolute top-4 right-4 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button 
                          onClick={() => handleStartEditItem(item)}
                          className="text-fg-muted hover:text-accent transition-colors"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button 
                          onClick={() => handleDeleteItem(item.id)}
                          className="text-fg-muted hover:text-red-500 transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>

                      <div className="flex items-start gap-3">
                        <div className={`p-2 rounded-lg shrink-0 ${item.type === 'note' ? 'bg-accent/10' : 'bg-blue-500/10'}`}>
                          {item.type === 'note' ? <FileText className="w-5 h-5 text-accent" /> : <LinkIcon className="w-5 h-5 text-blue-500" />}
                        </div>
                        <div className="flex-1 pr-16">
                          <h4 className="font-semibold text-fg-main text-lg">{item.title}</h4>
                          
                          {item.type === 'link' && (
                            <div className="mt-1 flex items-center gap-3">
                              <a href={item.url} target="_blank" rel="noopener noreferrer" className="text-sm text-blue-500 hover:underline break-all">
                                {item.url}
                              </a>
                              <span className="text-xs bg-border-main px-2 py-0.5 rounded-full font-medium text-fg-secondary uppercase">
                                {item.lang || 'INCONNU'}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                      
                      {item.type === 'note' && item.content && (
                        <div className="mt-2 text-sm text-fg-secondary whitespace-pre-wrap bg-editor-bg p-3 rounded-md border border-border-main/50 font-mono">
                          {item.content}
                        </div>
                      )}
                    </>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
