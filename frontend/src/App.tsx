import React from 'react';
import { Button } from './components/ui/button';

import { CampaignDashboard } from './components/CampaignDashboard';

export default function App() {

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card">
        <div className="container mx-auto max-w-6xl px-4 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div>
                <h1 className="text-2xl font-bold">Creative Automation Pipeline</h1>
                <p className="text-muted-foreground">
                  AI-powered social ad campaign generation
                </p>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto max-w-6xl px-4 py-8">  
          <CampaignDashboard />
      </main>

      {/* Footer */}
      <footer className="border-t bg-card mt-16">
        <div className="container mx-auto max-w-6xl px-4 py-8">
          <div className="text-center space-y-4">
            <div className="flex items-center justify-center gap-2">
              <span className="font-semibold">Created by Sohaib Sheikh</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}