import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { railwayService, RailwaySchedule } from "@/services/railwayService";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Power, PowerOff, Clock, Settings, Plus, Trash2, RefreshCw, Layers, CircleCheckBig, CircleX, Circle, Loader2, Globe, Train, Package, Lightbulb, Moon, Sparkles } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const RailwayManagementPage = () => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [projects, setProjects] = useState<any[]>([]);
  const [selectedProject, setSelectedProject] = useState<string>("");
  const [services, setServices] = useState<any[]>([]);
  const [environments, setEnvironments] = useState<any[]>([]);
  const [schedules, setSchedules] = useState<RailwaySchedule[]>([]);
  const [serviceStatuses, setServiceStatuses] = useState<Map<string, any>>(new Map());
  const [apiToken, setApiToken] = useState("");
  const [showTokenDialog, setShowTokenDialog] = useState(false);
  const [deployingServices, setDeployingServices] = useState<Set<string>>(new Set());
  const [deployProgress, setDeployProgress] = useState<Map<string, string>>(new Map());

  // Schedule form state
  const [newSchedule, setNewSchedule] = useState({
    service_id: "",
    service_name: "",
    environment_id: "",
    start_time: "08:00",
    stop_time: "18:00",
    days_of_week: [1, 2, 3, 4, 5], // Mon-Fri
    enabled: true
  });

  useEffect(() => {
    loadInitialData();
  }, []);

  useEffect(() => {
    if (selectedProject) {
      loadProjectServices(selectedProject);
    }
  }, [selectedProject]);

  const loadInitialData = async () => {
    try {
      setLoading(true);
      await loadProjects();
      await loadSchedules();
    } catch (error: any) {
      if (error.message.includes('not configured')) {
        setShowTokenDialog(true);
      } else {
        toast({
          title: "เกิดข้อผิดพลาด",
          description: error.message,
          variant: "destructive"
        });
      }
    } finally {
      setLoading(false);
    }
  };

  const loadProjects = async () => {
    const data = await railwayService.listProjects();
    setProjects(data);
    if (data.length > 0) {
      setSelectedProject(data[0].id);
    }
  };

  const loadProjectServices = async (projectId: string) => {
    const data = await railwayService.listServices(projectId);
    setServices(data.services.edges.map((e: any) => e.node));
    setEnvironments(data.environments.edges.map((e: any) => e.node));

    // Load status for all services
    if (data.environments.edges.length > 0) {
      const envId = data.environments.edges[0].node.id;
      for (const service of data.services.edges) {
        await loadServiceStatus(service.node.id, envId);
      }
    }
  };

  const loadServiceStatus = async (serviceId: string, environmentId: string) => {
    try {
      const status = await railwayService.getServiceStatus(serviceId, environmentId);
      setServiceStatuses(prev => new Map(prev).set(serviceId, status));
    } catch (error) {
      console.error('Failed to load service status:', error);
    }
  };

  const loadSchedules = async () => {
    const data = await railwayService.getSchedules();
    setSchedules(data);
  };

  const handleSaveToken = async () => {
    try {
      await railwayService.saveApiToken(apiToken);
      setShowTokenDialog(false);
      toast({
        title: "บันทึกสำเร็จ",
        description: "Railway API Token ถูกบันทึกแล้ว"
      });
      await loadInitialData();
    } catch (error: any) {
      toast({
        title: "เกิดข้อผิดพลาด",
        description: error.message,
        variant: "destructive"
      });
    }
  };

  const handleStartService = async (serviceId: string, environmentId: string) => {
    try {
      setLoading(true);
      setDeployingServices(prev => new Set(prev).add(serviceId));
      setDeployProgress(prev => new Map(prev).set(serviceId, "กำลังเริ่ม deployment..."));

      await railwayService.startService(serviceId, environmentId);

      // Poll deployment status
      let attempts = 0;
      const maxAttempts = 24; // 2 minutes (24 * 5 seconds)

      const pollStatus = async () => {
        attempts++;
        setDeployProgress(prev => new Map(prev).set(serviceId, `กำลัง deploy... (${attempts * 5}s)`));

        await loadServiceStatus(serviceId, environmentId);
        const status = serviceStatuses.get(serviceId);

        if (status?.status === 'running') {
          setDeployProgress(prev => new Map(prev).set(serviceId, "✅ Deployment สำเร็จ!"));
          setDeployingServices(prev => {
            const newSet = new Set(prev);
            newSet.delete(serviceId);
            return newSet;
          });
          toast({
            title: "เปิด Service สำเร็จ",
            description: "Service กำลังทำงานแล้ว",
            duration: 3000
          });
          return true;
        }

        if (attempts >= maxAttempts) {
          setDeployProgress(prev => new Map(prev).set(serviceId, "⏱️ Deployment ใช้เวลานาน กรุณารอสักครู่"));
          setDeployingServices(prev => {
            const newSet = new Set(prev);
            newSet.delete(serviceId);
            return newSet;
          });
          toast({
            title: "Deployment กำลังดำเนินการ",
            description: "กรุณารีเฟรชสถานะภายหลัง",
            duration: 5000
          });
          return true;
        }

        return false;
      };

      // Start polling
      for (let i = 0; i < maxAttempts; i++) {
        await new Promise(resolve => setTimeout(resolve, 5000));
        const isDone = await pollStatus();
        if (isDone) break;
      }

    } catch (error: any) {
      setDeployingServices(prev => {
        const newSet = new Set(prev);
        newSet.delete(serviceId);
        return newSet;
      });
      setDeployProgress(prev => {
        const newMap = new Map(prev);
        newMap.delete(serviceId);
        return newMap;
      });
      toast({
        title: "เกิดข้อผิดพลาด",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleStopService = async (serviceId: string, environmentId: string) => {
    try {
      setLoading(true);
      await railwayService.stopService(serviceId, environmentId);
      // Wait 3 seconds for Railway API to update
      await new Promise(resolve => setTimeout(resolve, 3000));
      await loadServiceStatus(serviceId, environmentId);
      toast({
        title: "ปิด Service สำเร็จ",
        description: "Service ถูกปิดแล้ว"
      });
    } catch (error: any) {
      toast({
        title: "เกิดข้อผิดพลาด",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCreateSchedule = async () => {
    try {
      await railwayService.createSchedule(newSchedule);
      await loadSchedules();
      toast({
        title: "สร้างตารางเวลาสำเร็จ",
        description: "ตารางเวลาเปิดปิดถูกบันทึกแล้ว"
      });
      // Reset form
      setNewSchedule({
        service_id: "",
        service_name: "",
        environment_id: "",
        start_time: "08:00",
        stop_time: "18:00",
        days_of_week: [1, 2, 3, 4, 5],
        enabled: true
      });
    } catch (error: any) {
      toast({
        title: "เกิดข้อผิดพลาด",
        description: error.message,
        variant: "destructive"
      });
    }
  };

  const handleDeleteSchedule = async (id: string) => {
    try {
      await railwayService.deleteSchedule(id);
      await loadSchedules();
      toast({
        title: "ลบตารางเวลาสำเร็จ"
      });
    } catch (error: any) {
      toast({
        title: "เกิดข้อผิดพลาด",
        description: error.message,
        variant: "destructive"
      });
    }
  };

  const handleToggleSchedule = async (id: string, enabled: boolean) => {
    try {
      await railwayService.toggleSchedule(id, enabled);
      await loadSchedules();
      toast({
        title: enabled ? "เปิดใช้งานตารางเวลา" : "ปิดใช้งานตารางเวลา"
      });
    } catch (error: any) {
      toast({
        title: "เกิดข้อผิดพลาด",
        description: error.message,
        variant: "destructive"
      });
    }
  };

  const getDayName = (day: number) => {
    const days = ['อา.', 'จ.', 'อ.', 'พ.', 'พฤ.', 'ศ.', 'ส.'];
    return days[day];
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Railway Management</h1>
          <p className="text-muted-foreground">จัดการและตั้งเวลา Railway Services</p>
        </div>
        <Dialog open={showTokenDialog} onOpenChange={setShowTokenDialog}>
          <DialogTrigger asChild>
            <Button variant="outline" size="sm">
              <Settings className="mr-2 h-4 w-4" />
              ตั้งค่า API Token
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Railway API Token</DialogTitle>
              <DialogDescription>
                ใส่ API Token จาก <a href="https://railway.com/account/tokens" target="_blank" className="text-primary underline">Railway Dashboard</a>
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>API Token</Label>
                <Input
                  type="password"
                  value={apiToken}
                  onChange={(e) => setApiToken(e.target.value)}
                  placeholder="Enter Railway API Token"
                />
              </div>
              <Button onClick={handleSaveToken} className="w-full">
                บันทึก
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <Tabs defaultValue="control" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="control">ควบคุม Services</TabsTrigger>
          <TabsTrigger value="schedule">ตั้งเวลาอัตโนมัติ</TabsTrigger>
        </TabsList>

        <TabsContent value="control" className="space-y-6">
          {/* Project Selector */}
          <Card className="border-2 border-blue-200 dark:border-blue-800 shadow-lg">
            <CardHeader className="bg-gradient-to-r from-blue-50 to-indigo-50">
              <CardTitle className="flex items-center text-xl gap-2">
                <Train className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                เลือก Railway Project
              </CardTitle>
              <CardDescription className="text-base">
                เลือก Project ที่ต้องการควบคุม Services
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-6">
              <Select value={selectedProject} onValueChange={setSelectedProject}>
                <SelectTrigger className="h-14 text-lg font-medium border-2 hover:border-blue-400 transition-colors">
                  <SelectValue placeholder="เลือก Project ที่ต้องการจัดการ..." />
                </SelectTrigger>
                <SelectContent>
                  {projects.map(project => (
                    <SelectItem key={project.id} value={project.id} className="text-base py-3">
                      <div className="flex items-center gap-2">
                        <Package className="h-4 w-4" />
                        {project.name}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </CardContent>
          </Card>

          {/* Services Control */}
          {services.length === 0 ? (
            <Card className="border-2 border-dashed border-border">
              <CardContent className="py-12 text-center">
                <Layers className="mx-auto h-16 w-16 text-muted-foreground mb-4" />
                <p className="text-lg text-muted-foreground">
                  {selectedProject
                    ? "ไม่พบ Services ใน Project นี้"
                    : "กรุณาเลือก Project ก่อน"}
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-6">
              {services.map(service => {
                const status = serviceStatuses.get(service.id);
                const isRunning = status?.status === 'running';
                const isStopped = status?.status === 'stopped';
                const isStaticSite = status?.isStaticSite || false;
                const envId = environments[0]?.id;
                const isDeploying = deployingServices.has(service.id);
                const progressMessage = deployProgress.get(service.id);

                return (
                  <Card
                    key={service.id}
                    className={`border-2 shadow-lg transition-all ${
                      isDeploying
                        ? 'border-blue-400 bg-blue-50 dark:bg-blue-950/50'
                        : isRunning
                        ? 'border-green-300 dark:border-green-700 bg-green-50 dark:bg-green-950/30'
                        : isStopped
                        ? 'border-red-300 dark:border-red-700 bg-red-50 dark:bg-red-950/30'
                        : 'border-border'
                    }`}
                  >
                    <CardHeader className="pb-4">
                      <div className="flex justify-between items-start gap-4">
                        <div className="flex-1 min-w-0">
                          <CardTitle className="text-2xl font-bold mb-2 flex items-center gap-2">
                            {isDeploying ? (
                              <Loader2 className="h-6 w-6 text-blue-600 dark:text-blue-400 animate-spin" />
                            ) : isRunning ? (
                              <CircleCheckBig className="h-6 w-6 text-green-600 dark:text-green-400" />
                            ) : isStopped ? (
                              <CircleX className="h-6 w-6 text-red-600 dark:text-red-400" />
                            ) : (
                              <Circle className="h-6 w-6 text-muted-foreground" />
                            )}
                            {service.name}
                          </CardTitle>
                          <CardDescription className="text-sm font-mono break-all">
                            ID: {service.id}
                          </CardDescription>
                        </div>
                        <div className="flex flex-col items-end gap-2 flex-shrink-0">
                          <Badge
                            variant={isDeploying ? "default" : isRunning ? "default" : "secondary"}
                            className={`text-base px-4 py-2 font-bold ${
                              isDeploying
                                ? 'bg-blue-600 hover:bg-blue-700'
                                : isRunning
                                ? 'bg-green-600 hover:bg-green-700'
                                : isStopped
                                ? 'bg-red-600 hover:bg-red-700'
                                : 'bg-muted0'
                            }`}
                          >
                            {isDeploying ? (
                              <span className="flex items-center gap-2">
                                <Loader2 className="h-4 w-4 animate-spin" />
                                กำลัง Deploy
                              </span>
                            ) : isRunning ? (
                              <span className="flex items-center gap-2">
                                <CircleCheckBig className="h-4 w-4" />
                                กำลังทำงาน
                              </span>
                            ) : isStopped ? (
                              <span className="flex items-center gap-2">
                                <CircleX className="h-4 w-4" />
                                หยุดแล้ว
                              </span>
                            ) : (
                              <span className="flex items-center gap-2">
                                <Circle className="h-4 w-4" />
                                ไม่ทราบ
                              </span>
                            )}
                          </Badge>
                          {isStaticSite && (
                            <Badge variant="outline" className="text-sm px-3 py-1 bg-purple-50 dark:bg-purple-950 border-purple-300 dark:border-purple-700 flex items-center gap-1">
                              <Globe className="h-3 w-3" />
                              Static Site
                            </Badge>
                          )}
                          {status?.numReplicas !== undefined && status.numReplicas > 0 && (
                            <Badge variant="outline" className="text-sm px-3 py-1 flex items-center gap-1">
                              <Layers className="h-3 w-3" />
                              {status.numReplicas} replica{status.numReplicas !== 1 ? 's' : ''}
                            </Badge>
                          )}
                          {status?.deploymentStatus && (
                            <Badge variant="outline" className="text-sm px-3 py-1 flex items-center gap-1">
                              <RefreshCw className="h-3 w-3" />
                              {status.deploymentStatus}
                            </Badge>
                          )}
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      {/* Deployment Progress */}
                      {isDeploying && progressMessage && (
                        <div className="mb-4 p-4 bg-blue-100 dark:bg-blue-900 border-2 border-blue-400 rounded-lg animate-pulse">
                          <div className="flex items-center gap-3">
                            <Loader2 className="h-5 w-5 text-blue-600 dark:text-blue-400 animate-spin flex-shrink-0" />
                            <p className="text-base font-semibold text-blue-900 dark:text-blue-100">{progressMessage}</p>
                          </div>
                        </div>
                      )}

                      <div className="flex flex-wrap gap-3">
                        <Button
                          onClick={() => handleStartService(service.id, envId)}
                          disabled={loading || isRunning || isDeploying}
                          className="flex-1 min-w-[140px] bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 text-white font-bold py-6 text-base shadow-md hover:shadow-lg transition-all disabled:opacity-50 disabled:from-gray-400 disabled:to-gray-500"
                          size="lg"
                        >
                          {isDeploying ? (
                            <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                          ) : (
                            <Power className="mr-2 h-5 w-5" />
                          )}
                          {isRunning ? 'เปิดอยู่แล้ว' : isStaticSite ? 'Redeploy' : 'เปิด Service'}
                        </Button>
                        <Button
                          onClick={() => handleStopService(service.id, envId)}
                          disabled={loading || !isRunning || isDeploying}
                          className="flex-1 min-w-[140px] bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 text-white font-bold py-6 text-base shadow-md hover:shadow-lg transition-all disabled:opacity-50 disabled:from-gray-400 disabled:to-gray-500"
                          size="lg"
                        >
                          <PowerOff className="mr-2 h-5 w-5" />
                          {!isRunning ? 'ปิดอยู่แล้ว' : 'ปิด Service'}
                        </Button>
                        <Button
                          onClick={() => loadServiceStatus(service.id, envId)}
                          disabled={loading || isDeploying}
                          variant="outline"
                          className="min-w-[140px] border-2 hover:bg-blue-50 dark:hover:bg-blue-950 dark:bg-blue-950 hover:border-blue-400 font-bold py-6 text-base transition-all"
                          size="lg"
                        >
                          <RefreshCw className={`mr-2 h-5 w-5 ${loading ? 'animate-spin' : ''}`} />
                          รีเฟรช
                        </Button>
                      </div>

                      {/* Status Info */}
                      {!isDeploying && (
                        <div className="mt-4 p-4 bg-blue-50 dark:bg-blue-950 border-2 border-blue-200 dark:border-blue-800 rounded-lg">
                          <p className="text-sm text-blue-800 dark:text-blue-200 flex items-start gap-2">
                            <Clock className="h-4 w-4 mt-0.5 flex-shrink-0" />
                            <span>
                              <strong>คำแนะนำ:</strong>
                              {isStaticSite
                                ? ' Static Site: กด "Redeploy" เพื่อเปิด หรือ "ปิด Service" เพื่อ remove deployment'
                                : ' ใช้ปุ่ม "เปิด/ปิด Service" เพื่อควบคุมทันที'
                              }
                              {' '}หรือไปที่แท็บ <strong>"ตั้งเวลาอัตโนมัติ"</strong> เพื่อตั้งค่าตารางเวลาประหยัดค่าใช้จ่าย
                            </span>
                          </p>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>

        <TabsContent value="schedule" className="space-y-4">
          {/* Create Schedule */}
          <Card className="border-2 border-primary/20">
            <CardHeader className="bg-primary/5">
              <CardTitle className="flex items-center text-xl">
                <Plus className="mr-2 h-6 w-6 text-primary" />
                สร้างตารางเวลาใหม่
              </CardTitle>
              <CardDescription className="text-base">
                ตั้งเวลาเปิดปิด Railway services อัตโนมัติเพื่อลดค่าใช้จ่าย
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6 pt-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label className="text-base font-semibold flex items-center gap-2">
                    <Train className="h-5 w-5" />
                    Service
                  </Label>
                  <Select
                    value={newSchedule.service_id}
                    onValueChange={(value) => {
                      const service = services.find(s => s.id === value);
                      setNewSchedule({
                        ...newSchedule,
                        service_id: value,
                        service_name: service?.name || ""
                      });
                    }}
                  >
                    <SelectTrigger className="h-12 text-base">
                      <SelectValue placeholder="เลือก Service ที่ต้องการตั้งเวลา" />
                    </SelectTrigger>
                    <SelectContent>
                      {services.length === 0 ? (
                        <div className="p-4 text-center text-muted-foreground">
                          ไม่มี Service (กรุณาเลือก Project ก่อน)
                        </div>
                      ) : (
                        services.map(service => (
                          <SelectItem key={service.id} value={service.id}>
                            {service.name}
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label className="text-base font-semibold flex items-center gap-2">
                    <Globe className="h-5 w-5" />
                    Environment
                  </Label>
                  <Select
                    value={newSchedule.environment_id}
                    onValueChange={(value) =>
                      setNewSchedule({ ...newSchedule, environment_id: value })
                    }
                  >
                    <SelectTrigger className="h-12 text-base">
                      <SelectValue placeholder="เลือก Environment" />
                    </SelectTrigger>
                    <SelectContent>
                      {environments.length === 0 ? (
                        <div className="p-4 text-center text-muted-foreground">
                          ไม่มี Environment
                        </div>
                      ) : (
                        environments.map(env => (
                          <SelectItem key={env.id} value={env.id}>
                            {env.name}
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label className="text-base font-semibold flex items-center gap-2">
                    <Clock className="h-5 w-5" />
                    เวลาเปิด
                  </Label>
                  <Input
                    type="time"
                    value={newSchedule.start_time}
                    onChange={(e) =>
                      setNewSchedule({ ...newSchedule, start_time: e.target.value })
                    }
                    className="h-12 text-base"
                  />
                  <p className="text-xs text-muted-foreground">Service จะเปิดอัตโนมัติในเวลานี้</p>
                </div>
                <div className="space-y-2">
                  <Label className="text-base font-semibold flex items-center gap-2">
                    <Moon className="h-5 w-5" />
                    เวลาปิด
                  </Label>
                  <Input
                    type="time"
                    value={newSchedule.stop_time}
                    onChange={(e) =>
                      setNewSchedule({ ...newSchedule, stop_time: e.target.value })
                    }
                    className="h-12 text-base"
                  />
                  <p className="text-xs text-muted-foreground">Service จะปิดอัตโนมัติในเวลานี้</p>
                </div>
              </div>

              <div className="space-y-3">
                <Label className="text-base font-semibold">วันที่ทำงาน</Label>
                <div className="flex gap-2 mt-2 flex-wrap justify-center bg-muted/30 p-4 rounded-lg">
                  {[0, 1, 2, 3, 4, 5, 6].map(day => {
                    const isSelected = newSchedule.days_of_week.includes(day);
                    return (
                      <Button
                        key={day}
                        type="button"
                        variant={isSelected ? "default" : "outline"}
                        size="lg"
                        className={`
                          min-w-[60px] font-semibold transition-all
                          ${isSelected
                            ? "bg-primary text-primary-foreground hover:bg-primary/90 scale-105 shadow-md"
                            : "hover:bg-muted"
                          }
                        `}
                        onClick={() => {
                          const days = newSchedule.days_of_week.includes(day)
                            ? newSchedule.days_of_week.filter(d => d !== day)
                            : [...newSchedule.days_of_week, day];
                          setNewSchedule({ ...newSchedule, days_of_week: days });
                        }}
                      >
                        {getDayName(day)}
                      </Button>
                    );
                  })}
                </div>
                <p className="text-sm text-muted-foreground text-center">
                  คลิกเพื่อเลือก/ยกเลิกวันที่ต้องการให้ทำงาน
                </p>
              </div>

              <div className="pt-4 border-t-2 border-dashed">
                <div className="mt-4 p-4 bg-blue-50 dark:bg-blue-950 dark:bg-blue-950 rounded-lg mb-4">
                  <p className="text-sm font-medium text-blue-900 dark:text-blue-100 dark:text-blue-100 flex items-center gap-2">
                    <Lightbulb className="h-5 w-5 flex-shrink-0" />
                    <span>
                      ตัวอย่าง: ตั้งเปิด 08:00 ปิด 18:00 จันทร์-ศุกร์ = ประหยัด ~70% ค่าใช้จ่าย!
                    </span>
                  </p>
                </div>
                <Button
                  onClick={handleCreateSchedule}
                  disabled={!newSchedule.service_id || !newSchedule.environment_id}
                  className="w-full bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 text-white font-bold py-7 text-lg shadow-lg hover:shadow-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:from-gray-400 disabled:to-gray-500"
                  size="lg"
                >
                  {(!newSchedule.service_id || !newSchedule.environment_id) ? (
                    <Clock className="mr-2 h-6 w-6" />
                  ) : (
                    <Sparkles className="mr-2 h-6 w-6" />
                  )}
                  {(!newSchedule.service_id || !newSchedule.environment_id)
                    ? "กรุณาเลือก Service และ Environment ก่อน"
                    : "สร้างตารางเวลา"
                  }
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Schedules List */}
          <Card>
            <CardHeader>
              <CardTitle>ตารางเวลาทั้งหมด</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {schedules.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">
                  ยังไม่มีตารางเวลา
                </p>
              ) : (
                schedules.map(schedule => (
                  <Card key={schedule.id}>
                    <CardContent className="pt-6">
                      <div className="flex justify-between items-start">
                        <div className="space-y-2">
                          <div className="font-semibold">{schedule.service_name}</div>
                          <div className="text-sm text-muted-foreground">
                            <Clock className="inline h-3 w-3 mr-1" />
                            เปิด {schedule.start_time} - ปิด {schedule.stop_time}
                          </div>
                          <div className="flex gap-1">
                            {schedule.days_of_week.map(day => (
                              <Badge key={day} variant="outline" className="text-xs">
                                {getDayName(day)}
                              </Badge>
                            ))}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Switch
                            checked={schedule.enabled}
                            onCheckedChange={(checked) =>
                              handleToggleSchedule(schedule.id!, checked)
                            }
                          />
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDeleteSchedule(schedule.id!)}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default RailwayManagementPage;
