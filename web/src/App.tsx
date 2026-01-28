// ScreenMu Web App - Main Application
// LLM-assisted: initial scaffold generated with AI assistance per hackathon disclosure rules.

import { useState, useCallback, useEffect } from 'react';
import { RecordView } from './views/RecordView';
import { EditView } from './views/EditView';
import type { Project } from './types';
import './styles/App.css';

type View = 'home' | 'record' | 'edit';

function App() {
  const [view, setView] = useState<View>('home');
  const [currentProject, setCurrentProject] = useState<Project | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);

  const handleRecordingComplete = useCallback((project: Project) => {
    setCurrentProject(project);
    setProjects((prev) => [...prev, project]);
    setView('edit');
  }, []);

  const handleExport = useCallback((project: Project) => {
    // For now, just download the original video
    // Full export with effects would use WebCodecs
    if (project.videoBlob) {
      const url = URL.createObjectURL(project.videoBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${project.name}.webm`;
      a.click();
      URL.revokeObjectURL(url);
    }
  }, []);

  const handleOpenProject = useCallback((project: Project) => {
    setCurrentProject(project);
    setView('edit');
  }, []);

  // Listen for extension import
  useEffect(() => {
    const handleMessage = async (event: MessageEvent) => {
      if (event.data?.type === 'SCREENMU_EXTENSION_IMPORT') {
        console.log('[ScreenMu App] Received import from extension');
        const { videoBase64, audioBase64, cameraBase64, recordingData } = event.data.data;

        console.log('[ScreenMu App] videoBase64 length:', videoBase64?.length);
        console.log('[ScreenMu App] audioBase64:', audioBase64 ? `${audioBase64.length} bytes` : 'none');
        console.log('[ScreenMu App] cameraBase64:', cameraBase64 ? `${cameraBase64.length} bytes` : 'none');

        try {
          // Convert screen video base64 back to Blob (required)
          const videoRes = await fetch(videoBase64);
          const videoBlob = await videoRes.blob();
          console.log('[ScreenMu App] Video blob size:', videoBlob.size, 'type:', videoBlob.type);

          // Convert audio base64 to Blob (optional)
          let audioBlob = undefined;
          if (audioBase64) {
            const audioRes = await fetch(audioBase64);
            audioBlob = await audioRes.blob();
            console.log('[ScreenMu App] Audio blob size:', audioBlob.size, 'type:', audioBlob.type);
          }

          // Convert camera base64 to Blob (optional)
          let cameraBlob = undefined;
          if (cameraBase64) {
            const cameraRes = await fetch(cameraBase64);
            cameraBlob = await cameraRes.blob();
            console.log('[ScreenMu App] Camera blob size:', cameraBlob.size, 'type:', cameraBlob.type);
          }

          // Transform extension signals to engine format
          const transformedSignals = recordingData.signals.map((sig: any) => {
            const timestamp = sig.timestamp;

            // Map extension event types to engine event types
            let event_type;
            switch (sig.type) {
              case 'MOUSE_MOVE':
                event_type = {
                  type: 'MouseMove',
                  position: { x: sig.x, y: sig.y }
                };
                break;
              case 'MOUSE_CLICK':
                event_type = {
                  type: 'MouseClick',
                  position: { x: sig.x, y: sig.y },
                  button: sig.button || 0
                };
                break;
              case 'FOCUS_CHANGE':
                event_type = {
                  type: 'FocusChange',
                  bounds: sig.bounds
                };
                break;
              case 'SCROLL':
                event_type = {
                  type: 'Scroll',
                  delta_y: sig.deltaY
                };
                break;
              default:
                return null; // Skip unknown types
            }

            return { timestamp, event_type };
          }).filter(Boolean); // Remove nulls

          const project: Project = {
            id: crypto.randomUUID(),
            name: `Extension Recording ${new Date(recordingData.createdAt).toLocaleString()}`,
            createdAt: recordingData.createdAt,
            captureMode: 'Tab',
            duration: recordingData.duration * 1000, // ms to us
            videoBlob: videoBlob,
            audioBlob: audioBlob,      // Now supported!
            cameraBlob: cameraBlob,    // Now supported!
            signals: { events: transformedSignals },
            editSettings: {
              zoomStrength: 1.5,
              padding: 0.1,
              theme: 'dark',
              clickRings: true,
              cursorHighlight: true,
            },
          };

          handleRecordingComplete(project);
        } catch (err) {
          console.error('[ScreenMu App] Failed to import extension data:', err);
        }
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [handleRecordingComplete]);

  return (
    <div className="app">
      {view === 'home' && (
        <div className="home-view">
          <header className="app-header">
            <h1>ScreenMu</h1>
            <p>Screen Studio-style recording for the web</p>
          </header>

          <div className="home-actions">
            <button className="btn btn-primary btn-large" onClick={() => setView('record')}>
              New Recording
            </button>
          </div>

          {projects.length > 0 && (
            <div className="projects-list">
              <h2>Recent Projects</h2>
              <div className="projects-grid">
                {projects.map((project) => (
                  <div
                    key={project.id}
                    className="project-card"
                    onClick={() => handleOpenProject(project)}
                  >
                    <div className="project-thumbnail">
                      {project.videoBlob && (
                        <video src={URL.createObjectURL(project.videoBlob)} />
                      )}
                    </div>
                    <div className="project-info">
                      <h3>{project.name}</h3>
                      <span>{new Date(project.createdAt).toLocaleDateString()}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {view === 'record' && (
        <RecordView onRecordingComplete={handleRecordingComplete} />
      )}

      {view === 'edit' && currentProject && (
        <EditView
          project={currentProject}
          onExport={handleExport}
          onBack={() => setView('home')}
        />
      )}
    </div>
  );
}

export default App;
