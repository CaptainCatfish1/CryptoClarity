import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Loader2, SendIcon } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function ContactForm() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    
    // Format subject line with required prefix if not already included
    const formattedSubject = subject.startsWith("Crypto Clarity Request:") 
      ? subject 
      : `Crypto Clarity Request: ${subject}`;
    
    // For demo purposes, we'll just simulate a successful submission
    try {
      // This would normally be an API call to send an email
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      toast({
        title: "Message Sent Successfully!",
        description: "Thanks for contacting us. We'll respond to your message within 24-48 hours.",
      });
      
      // Clear form
      setName("");
      setEmail("");
      setSubject("");
      setMessage("");
    } catch (error) {
      toast({
        title: "Couldn't Send Your Message",
        description: "We encountered a problem sending your message. Please try again or contact us directly at brentphayward1@gmail.com.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Card className="bg-gray-900 border-gray-800 w-full max-w-lg mx-auto">
      <CardHeader>
        <CardTitle className="text-xl text-white">Have a Question? Reach Out to Us</CardTitle>
        <CardDescription className="text-gray-400">
          Whether you need help with a term or have concerns about a transaction, we're ready to assist you.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 gap-4">
            <div>
              <label htmlFor="name" className="block text-sm font-medium text-gray-300 mb-1">
                Name <span className="text-gray-500 font-normal">(optional)</span>
              </label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Your name"
                className="w-full bg-gray-800 border-gray-700 text-white"
              />
            </div>
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-300 mb-1">
                Email
              </label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="your.email@example.com"
                className="w-full bg-gray-800 border-gray-700 text-white"
                required
              />
            </div>
            <div>
              <label htmlFor="subject" className="block text-sm font-medium text-gray-300 mb-1">
                Subject
              </label>
              <Input
                id="subject"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="For example: Question about crypto terms, help with suspicious wallet, etc."
                className="w-full bg-gray-800 border-gray-700 text-white"
                required
              />
              <p className="text-xs text-gray-500 mt-1">
                "Crypto Clarity Request:" will be automatically added to subject line
              </p>
            </div>
            <div>
              <label htmlFor="message" className="block text-sm font-medium text-gray-300 mb-1">
                Message
              </label>
              <Textarea
                id="message"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Tell us what you need help with and we'll do our best to assist you."
                rows={4}
                className="w-full bg-gray-800 border-gray-700 text-white"
                required
              />
            </div>
          </div>
          <Button
            type="submit"
            className="w-full bg-purple-700 hover:bg-purple-600 text-white"
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Sending...
              </>
            ) : (
              <>
                <SendIcon className="mr-2 h-4 w-4" />
                Send Message
              </>
            )}
          </Button>
        </form>
      </CardContent>
      <CardFooter className="text-xs text-gray-400 justify-center">
        <p>Messages sent will be directed to brentphayward1@gmail.com</p>
      </CardFooter>
    </Card>
  );
}