import React, { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { ArrowLeft, BookMarked, ListFilter, Plus } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import RegisterTable from '@/components/Register/RegisterTable';
import RegisterForm from '@/components/Register/RegisterForm';

const RegisterExternalPage: React.FC = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('table');
  const tableRefreshRef = useRef(0);

  const handleSaved = () => {
    setActiveTab('table');
    tableRefreshRef.current += 1;
  };

  return (
    <div className="min-h-screen bg-background pb-24">
      {/* Gradient Header */}
      <div className="bg-gradient-to-r from-purple-500 to-violet-500 dark:from-purple-700 dark:to-violet-700">
        <div className="container mx-auto px-4 py-6">
          <div className="max-w-6xl mx-auto">
            <div className="flex items-center gap-3">
              <Button
                variant="ghost"
                size="icon"
                className="text-white/80 hover:text-white hover:bg-white/20"
                onClick={() => navigate('/create-document')}
              >
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <div className="flex items-center gap-3">
                <div className="p-3 rounded-xl bg-white/20 backdrop-blur-sm">
                  <BookMarked className="h-6 w-6 text-white" />
                </div>
                <div>
                  <h1 className="text-xl font-bold text-white">ทะเบียนรับภายนอก</h1>
                  <p className="text-sm text-purple-100">รายการจากหนังสือรับ (Doc Receive)</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 -mt-4">
        <div className="max-w-6xl mx-auto">
          {/* Tabs Card */}
          <Card className="shadow-lg border-0">
            <CardContent className="p-0">
              <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                <div className="border-b px-4 pt-4">
                  <TabsList className="grid w-full grid-cols-2 bg-purple-50 dark:bg-purple-950/30">
                    <TabsTrigger
                      value="table"
                      className="gap-2 data-[state=active]:bg-white data-[state=active]:text-purple-700 data-[state=active]:shadow-sm dark:data-[state=active]:bg-purple-900/50"
                    >
                      <ListFilter className="h-4 w-4" />
                      ทะเบียนหนังสือรับ
                    </TabsTrigger>
                    <TabsTrigger
                      value="add"
                      className="gap-2 data-[state=active]:bg-white data-[state=active]:text-purple-700 data-[state=active]:shadow-sm dark:data-[state=active]:bg-purple-900/50"
                    >
                      <Plus className="h-4 w-4" />
                      เพิ่มรายการ
                    </TabsTrigger>
                  </TabsList>
                </div>

                <TabsContent value="table" className="p-4 mt-0">
                  <RegisterTable
                    key={tableRefreshRef.current}
                    viewName="register_external_view"
                  />
                </TabsContent>

                <TabsContent value="add" className="p-4 mt-0">
                  <RegisterForm registerType="external" onSaved={handleSaved} />
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default RegisterExternalPage;
